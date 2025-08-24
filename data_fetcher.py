import pandas as pd
from sleeperpy import Leagues, Players
from datetime import datetime
import requests

def get_league_data(league_id, season):
    """Fetches and processes data for a given Sleeper league."""
    try:
        league = Leagues.get_league(league_id)
        rosters = Leagues.get_rosters(league_id)
        users = Leagues.get_users(league_id)
        user_map = {user["user_id"]: {"display_name": user["display_name"], "avatar": user.get("avatar")} for user in users}
        roster_map = {roster["roster_id"]: user_map.get(roster.get("owner_id"), {"display_name": "Unknown", "avatar": None}) for roster in rosters}

        data = []
        for roster in rosters:
            owner_id = roster.get("owner_id")
            if owner_id and owner_id in user_map:
                user_info = user_map[owner_id]
                avatar_url = f"https://sleepercdn.com/avatars/thumbs/{user_info['avatar']}" if user_info['avatar'] else "https://placehold.co/50x50/EBF4FF/76A9FA?text=?"
                settings = roster.get("settings", {})
                data.append({
                    "Team": user_info["display_name"], "Avatar": avatar_url,
                    "Wins": settings.get("wins", 0), "Losses": settings.get("losses", 0),
                    "Points For": settings.get("fpts", 0) + (settings.get("fpts_decimal", 0) / 100)
                })

        df = pd.DataFrame(data)
        current_week = league.get("settings", {}).get("leg", 1)
        if season != str(datetime.now().year):
            current_week = 18
        return df, roster_map, current_week, league.get("roster_positions", [])
    except Exception as e:
        print(f"An error occurred while getting league data for {season}: {e}")
        return pd.DataFrame(), {}, 1, []

def calculate_fdvoa(league_id, roster_map, current_week):
    """Calculates a DVOA-like rating for each fantasy team."""
    if not roster_map or current_week <= 1: return pd.DataFrame()
    all_scores = {}
    for week in range(1, current_week):
        try:
            matchups = Leagues.get_matchups(league_id, week)
            weekly_scores = {r["roster_id"]: r["points"] for r in matchups if r.get("points") is not None}
            if weekly_scores: all_scores[week] = weekly_scores
        except Exception as e:
            print(f"Could not fetch matchups for week {week}: {e}")
    if not all_scores: return pd.DataFrame()

    team_season_stats = {rid: [] for rid in roster_map.keys()}
    for scores in all_scores.values():
        for rid, score in scores.items():
            if rid in team_season_stats: team_season_stats[rid].append(score)

    team_season_avg = {rid: sum(s) / len(s) if s else 0 for rid, s in team_season_stats.items()}
    all_points = [p for s in team_season_stats.values() for p in s]
    league_overall_avg = sum(all_points) / len(all_points) if all_points else 0

    team_weekly_fdvoa = {rid: [] for rid in roster_map.keys()}
    for week, weekly_scores in all_scores.items():
        if not weekly_scores: continue
        league_weekly_avg = sum(weekly_scores.values()) / len(weekly_scores)
        matchup_pairs = {}
        for m in Leagues.get_matchups(league_id, week):
            mid = m.get('matchup_id')
            if mid:
                if mid not in matchup_pairs: matchup_pairs[mid] = []
                matchup_pairs[mid].append(m['roster_id'])
        for rid, score in weekly_scores.items():
            opponent_id = None
            for pair in matchup_pairs.values():
                if rid in pair and len(pair) > 1:
                    opponent_id = pair[0] if pair[1] == rid else pair[1]
                    break
            if opponent_id:
                voa = score - league_weekly_avg
                opp_avg = team_season_avg.get(opponent_id, league_overall_avg)
                adj = (opp_avg - league_overall_avg) / 2
                fdvoa_pts = voa + adj
                fdvoa_pct = (fdvoa_pts / league_weekly_avg) * 100 if league_weekly_avg > 0 else 0
                if rid in team_weekly_fdvoa: team_weekly_fdvoa[rid].append(fdvoa_pct)

    fdvoa_data = [{"Team": roster_map.get(rid, {}).get("display_name", "Unknown"), "F-DVOA (%)": sum(wr) / len(wr)} for rid, wr in team_weekly_fdvoa.items() if wr]
    fdvoa_df = pd.DataFrame(fdvoa_data)
    return fdvoa_df.sort_values(by="F-DVOA (%)", ascending=False) if not fdvoa_df.empty else fdvoa_df

def calculate_power_rankings(standings_df, fdvoa_df, current_week, total_weeks=17):
    """Calculates power rankings with linear weighting."""
    if standings_df.empty: return pd.DataFrame()
    if fdvoa_df.empty:
        pr_df = standings_df.sort_values(by="Points For", ascending=False).reset_index(drop=True)
        pr_df["Rank"] = pr_df.index + 1
        max_pf, min_pf = pr_df["Points For"].max(), pr_df["Points For"].min()
        pr_df["Power Score"] = (pr_df["Points For"] - min_pf) / (max_pf - min_pf) if (max_pf - min_pf) > 0 else 0.5
        return pr_df[["Rank", "Team", "Avatar", "Power Score"]]

    merged_df = pd.merge(standings_df, fdvoa_df, on="Team")
    if merged_df.empty: return pd.DataFrame()
    for col in ["Points For", "F-DVOA (%)"]:
        min_val, max_val = merged_df[col].min(), merged_df[col].max()
        merged_df[f"{col}_norm"] = (merged_df[col] - min_val) / (max_val - min_val) if (max_val - min_val) > 0 else 0.5
    dvoa_weight = (current_week - 1) / total_weeks if current_week > 1 else 0
    merged_df["Power Score"] = (merged_df["Points For_norm"] * (1 - dvoa_weight)) + (merged_df["F-DVOA (%)_norm"] * dvoa_weight)
    pr_df = merged_df.sort_values(by="Power Score", ascending=False).reset_index(drop=True)
    pr_df["Rank"] = pr_df.index + 1
    return pr_df[["Rank", "Team", "Avatar", "Power Score"]]

def get_rosters_and_projections(league_id, roster_map, week, season, roster_positions):
    """Fetches weekly rosters and projections and formats them into a DataFrame."""
    try:
        all_players = Players.get_all_players()
        season_type = "pre" if season == str(datetime.now().year) and week == 1 else "regular"
        proj_url = f"https://api.sleeper.app/v1/projections/nfl/{season_type}/{season}/{week}"
        proj_response = requests.get(proj_url)
        projections = proj_response.json() if proj_response.status_code == 200 else []
        projection_map = {p['player_id']: p for p in projections}
        
        matchups = Leagues.get_matchups(league_id, week)
        teams_data = []

        for roster_id, team_info in roster_map.items():
            team_matchup = next((m for m in matchups if m['roster_id'] == roster_id), None)
            if not team_matchup or 'starters' not in team_matchup: continue
            
            team_row = {"Team": team_info['display_name'], "Avatar": f"https://sleepercdn.com/avatars/thumbs/{team_info['avatar']}" if team_info.get('avatar') else "https://placehold.co/50x50/EBF4FF/76A9FA?text=?"}
            total_projection = 0.0
            
            starters_info = []
            for player_id in team_matchup['starters']:
                player_info = all_players.get(player_id)
                if not player_info: continue
                
                proj_data = projection_map.get(player_id)
                projection = 0.0
                if proj_data and proj_data.get('stats'):
                    stats = proj_data['stats']
                    projection = stats.get('pts_ppr') or stats.get('pts_half_ppr') or stats.get('pts_std') or 0.0
                
                projection = projection if projection is not None else 0.0
                total_projection += projection
                starters_info.append({"info": player_info, "projection": projection})

            pos_starters = {pos: [] for pos in ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']}
            for s in starters_info:
                pos = s['info'].get('position')
                if pos in pos_starters:
                    pos_starters[pos].append(s)
            
            flex_pool = pos_starters['RB'] + pos_starters['WR'] + pos_starters['TE']
            
            slot_counters = {pos: 0 for pos in ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF']}
            for slot in roster_positions:
                player = None
                col_name = ""
                if slot in ['QB', 'K', 'DEF'] and pos_starters.get(slot):
                    player = pos_starters[slot].pop(0)
                    col_name = slot
                elif slot in ['RB', 'WR', 'TE'] and pos_starters.get(slot):
                    player = pos_starters[slot].pop(0)
                    slot_counters[slot] += 1
                    col_name = f"{slot}{slot_counters[slot]}"
                elif slot == 'FLEX' and flex_pool:
                    player = flex_pool.pop(0)
                    slot_counters[slot] += 1
                    col_name = f"FLEX{slot_counters[slot]}"
                
                if player:
                    player_name = f"{player['info'].get('first_name', '')} {player['info'].get('last_name', '')}".strip() if player['info'].get('position') == 'DEF' else player['info'].get('full_name', 'N/A')
                    team_row[col_name] = f"{player_name} ({player['projection']:.2f})"

            team_row["Total"] = total_projection
            teams_data.append(team_row)
        
        df = pd.DataFrame(teams_data)
        return df.sort_values(by="Total", ascending=False) if not df.empty else df
    except Exception as e:
        print(f"An error occurred while getting rosters and projections: {e}")
        return pd.DataFrame()

def calculate_positional_averages(league_id, roster_map, current_week, season):
    """Calculates the average points per position for each team."""
    if current_week <= 1: return pd.DataFrame()
    try:
        all_players = Players.get_all_players()
        all_weekly_stats = {}
        for week in range(1, current_week):
            stats_url = f"https://api.sleeper.app/v1/stats/nfl/regular/{season}/{week}"
            stats_response = requests.get(stats_url)
            all_weekly_stats[week] = stats_response.json() if stats_response.status_code == 200 else {}
        
        pos_types = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
        team_positional_scores = {rid: {pos: [] for pos in pos_types} for rid in roster_map.keys()}
        
        for week in range(1, current_week):
            matchups = Leagues.get_matchups(league_id, week)
            weekly_stats = all_weekly_stats.get(week, {})
            for m in matchups:
                rid, starters = m.get('roster_id'), m.get('starters', [])
                if not rid or not starters: continue
                for pid in starters:
                    p_info, p_stats = all_players.get(pid), weekly_stats.get(pid)
                    if p_info and p_stats:
                        pos = p_info.get('position')
                        if pos in team_positional_scores[rid]: 
                            team_positional_scores[rid][pos].append(p_stats.get('pts_ppr', 0.0) or 0.0)
        
        avg_data = []
        for rid, pos_scores in team_positional_scores.items():
            team_avg = {"Team": roster_map.get(rid, {}).get("display_name", "Unknown")}
            for pos, scores in pos_scores.items():
                team_avg[pos] = sum(scores) / (current_week - 1) if (current_week - 1) > 0 else 0
            avg_data.append(team_avg)
        
        df = pd.DataFrame(avg_data)
        if not df.empty:
            df['Total'] = df[pos_types].sum(axis=1)
            df = df.sort_values(by='Total', ascending=False)
        return df
    except Exception as e:
        print(f"An error occurred while calculating positional averages: {e}")
        return pd.DataFrame()
