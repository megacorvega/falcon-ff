import pandas as pd
from sleeperpy import Leagues, Players
from datetime import datetime
import requests
import traceback

def get_league_data(league_id, season):
    """
    Fetches and processes basic league data including standings, rosters, and users.
    """
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
        season_type = league.get("season_type", "regular")

        if season != str(datetime.now().year):
            current_week = 17
        
        return df, roster_map, current_week, season_type
    except Exception as e:
        print(f"An error occurred while getting league data for {season}: {e}")
        return pd.DataFrame(), {}, 1, "regular"

def calculate_fdvoa(league_id, roster_map, current_week):
    """
    Calculates a DVOA-like rating (F-DVOA) for each fantasy team.
    """
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
            opponent_id = next((pair[0] if pair[1] == rid else pair[1] for pair in matchup_pairs.values() if rid in pair and len(pair) > 1), None)
            
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
    """
    Calculates power rankings with a linear weighting system.
    """
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

def get_live_game_status():
    """Fetches the current NFL week from Sleeper's state endpoint."""
    try:
        state_res = requests.get("https://api.sleeper.app/v1/state/nfl")
        if state_res.status_code == 200:
            return state_res.json().get("week", 1)
    except Exception as e:
        print(f"Could not fetch live game state: {e}")
    return 1

def get_analysis_data(league_id, roster_map, week, season, season_type):
    """
    Fetches analysis data, combining projections and live scores for the current week.
    For past seasons, it calculates season-long positional averages.
    """
    try:
        all_players = Players.get_all_players()
        is_current_season = (season == str(datetime.now().year))

        if not is_current_season:
            # Logic for past seasons remains unchanged
            team_scores = {roster_id: {pos: [] for pos in ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']} for roster_id in roster_map.keys()}
            for w in range(1, 18):
                matchups = Leagues.get_matchups(league_id, w)
                for matchup in matchups:
                    roster_id, starters, player_points = matchup.get('roster_id'), matchup.get('starters', []), matchup.get('players_points', {})
                    if roster_id not in team_scores: continue
                    for player_id in starters:
                        player_info = all_players.get(player_id)
                        if player_info and player_info.get('position') in team_scores[roster_id]:
                            team_scores[roster_id][player_info['position']].append(player_points.get(player_id, 0))
            teams_data = []
            for roster_id, pos_scores in team_scores.items():
                team_info = roster_map.get(roster_id)
                if not team_info: continue
                team_row = {"Team": team_info['display_name'], "Avatar": f"https://sleepercdn.com/avatars/thumbs/{team_info['avatar']}" if team_info.get('avatar') else "https://placehold.co/50x50/EBF4FF/76A9FA?text=?"}
                total_avg = sum(sum(scores) / len(scores) if scores else 0 for scores in pos_scores.values())
                for pos, scores in pos_scores.items():
                    team_row[pos] = sum(scores) / len(scores) if scores else 0
                team_row["Total"] = total_avg
                teams_data.append(team_row)
            df = pd.DataFrame(teams_data)
            return df.sort_values(by="Total", ascending=False) if not df.empty else df
        else:
            # --- Logic for Current Season (Projections, Live Scores) ---
            
            # **FIX**: Corrected the API endpoint for projections.
            proj_url = f"https://api.sleeper.app/v1/projections/nfl/{season}/{week}"
            proj_res = requests.get(proj_url)
            projections = proj_res.json() if proj_res.status_code == 200 else []
            if not projections:
                print(f"Warning: Projections API returned no data for week {week}. URL: {proj_url}")
            projection_map = {p['player_id']: p for p in projections}

            live_scores = {}
            live_url = f"https://api.sleeper.app/v1/league/{league_id}/matchups/{week}"
            live_matchups = requests.get(live_url).json()
            for matchup in live_matchups:
                for player_id, points in matchup.get('players_points', {}).items():
                    live_scores[player_id] = points

            rosters = Leagues.get_rosters(league_id)
            teams_data = []
            for roster in rosters:
                roster_id, starters, team_info = roster.get('roster_id'), roster.get('starters', []), roster_map.get(roster.get('roster_id'))
                if not all([roster_id, starters, team_info]): continue
                
                team_row = {"Team": team_info['display_name'], "Avatar": f"https://sleepercdn.com/avatars/thumbs/{team_info['avatar']}" if team_info.get('avatar') else "https://placehold.co/50x50/EBF4FF/76A9FA?text=?"}
                positional_scores = {pos: {'projected': 0.0, 'live': 0.0, 'status': 'projected'} for pos in ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']}
                
                for player_id in starters:
                    player_info = all_players.get(player_id)
                    if not player_info: continue
                    pos = player_info.get('position')
                    if pos not in positional_scores: continue

                    proj_data = projection_map.get(player_id, {})
                    stats = proj_data.get('stats', {})
                    projected_pts = stats.get('pts_ppr', 0) or 0.0
                    positional_scores[pos]['projected'] += projected_pts

                    live_pts = live_scores.get(player_id)
                    if live_pts is not None:
                        positional_scores[pos]['live'] += live_pts
                        positional_scores[pos]['status'] = 'active'

                total_projected, total_live = 0, 0
                for pos, data in positional_scores.items():
                    team_row[f"{pos}_projected"] = data['projected']
                    team_row[f"{pos}_live"] = data['live']
                    team_row[f"{pos}_status"] = data['status']
                    total_projected += data['projected']
                    total_live += data['live']
                
                team_row["Total_projected"] = total_projected
                team_row["Total_live"] = total_live
                teams_data.append(team_row)

            return pd.DataFrame(teams_data)

    except Exception as e:
        print(f"An error occurred in get_analysis_data: {e}")
        traceback.print_exc()
        return pd.DataFrame()

def get_weekly_scores_for_season(league_id, roster_map):
    """
    Fetches the total points scored for each team for each week of a season.
    """
    if not roster_map: return {}
    team_weekly_scores = {roster_id: [] for roster_id in roster_map.keys()}
    for w in range(1, 18):
        try:
            matchups = Leagues.get_matchups(league_id, w)
            weekly_points = {m['roster_id']: m['points'] for m in matchups if 'points' in m}
            for roster_id in team_weekly_scores.keys():
                team_weekly_scores[roster_id].append(weekly_points.get(roster_id, 0))
        except Exception as e:
            print(f"Could not fetch matchups for week {w} while getting weekly scores: {e}")
    return team_weekly_scores

