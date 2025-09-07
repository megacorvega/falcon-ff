import os
import pandas as pd
import plotly.express as px
from sleeperpy import Leagues, Players
from datetime import datetime
import json
import requests
import data_fetcher

# --- Configuration ---
# **FIX**: It's better to fetch the current league ID dynamically if possible,
# but for now, this remains the starting point.
LEAGUE_ID = "1052601214833274880" 
LEAGUE_LOGO_URL = "https://i.imgur.com/uCkJvgd.png"

def find_league_history(start_league_id, num_years=3):
    """Finds the last few years of a league's history starting from the given ID."""
    league_ids = {}
    current_league_id = start_league_id
    
    for _ in range(num_years):
        try:
            res = requests.get(f"https://api.sleeper.app/v1/league/{current_league_id}")
            if res.status_code == 200:
                league_info = res.json()
                season = league_info.get("season")
                if season:
                    league_ids[season] = current_league_id
                current_league_id = league_info.get("previous_league_id")
                if not current_league_id:
                    break
            else:
                print(f"Failed to fetch league {current_league_id}. Status: {res.status_code}")
                break
        except Exception as e:
            print(f"An error occurred while fetching league history: {e}")
            break
    return league_ids

def generate_data_file_for_year(year, league_id):
    """Generates a single JSON data file for a specific year."""
    print(f"--- Generating data for {year} ---")
    
    standings_df, roster_map, current_week, season_type = data_fetcher.get_league_data(league_id, year)
    
    if standings_df.empty or not roster_map:
        print(f"No standings or roster data found for {year}. Skipping file generation.")
        return

    fdvoa_df = data_fetcher.calculate_fdvoa(league_id, roster_map, current_week)
    
    avatar_df = standings_df[['Team', 'Avatar']].copy()
    if not fdvoa_df.empty:
        fdvoa_df_with_avatars = pd.merge(fdvoa_df, avatar_df, on="Team", how="left")
    else:
        # If F-DVOA is empty (e.g., before week 2), create a placeholder
        teams = [{"Team": v['display_name'], "Avatar": f"https://sleepercdn.com/avatars/thumbs/{v['avatar']}" if v.get('avatar') else "https://placehold.co/50x50/EBF4FF/76A9FA?text=?", "F-DVOA (%)": 0} for v in roster_map.values()]
        fdvoa_df_with_avatars = pd.DataFrame(teams)


    power_rankings_df = data_fetcher.calculate_power_rankings(standings_df, fdvoa_df, current_week)
    
    # **FIX**: Determine the correct week for analysis. Use live state for current year.
    analysis_week = data_fetcher.get_live_game_status() if year == str(datetime.now().year) else current_week
    rosters_df = data_fetcher.get_analysis_data(league_id, roster_map, analysis_week, year, season_type)
    
    is_current = year == str(datetime.now().year)
    analysis_type = "scores" if is_current else "averages"

    weekly_scores_data = {}
    if not is_current:
        raw_weekly_scores = data_fetcher.get_weekly_scores_for_season(league_id, roster_map)
        weekly_scores_data = {roster_map[rid]['display_name']: scores for rid, scores in raw_weekly_scores.items() if rid in roster_map}

    year_data = {
        "power_rankings": power_rankings_df.to_dict(orient='records'),
        "fdvoa": fdvoa_df_with_avatars.to_dict(orient='records'),
        "rosters": rosters_df.to_dict(orient='records'),
        "projection_week": analysis_week,
        "analysis_type": analysis_type,
        "weekly_scores": weekly_scores_data
    }

    with open(f"data_{year}.json", "w") as f:
        json.dump(year_data, f, indent=4)
    
    print(f"--- Finished generating data_{year}.json ---")

if __name__ == "__main__":
    # **FIX**: Start with the user's specific league ID for the most recent season they manage.
    # This assumes the script is being run for the 2025 season start.
    # For a more robust solution, you could use the Sleeper API to find a user's leagues for the current year.
    USER_ID = "992161421252763648" # Example user ID, replace if necessary
    CURRENT_YEAR = str(datetime.now().year)
    
    try:
        res = requests.get(f"https://api.sleeper.app/v1/user/{USER_ID}/leagues/nfl/{CURRENT_YEAR}")
        if res.status_code == 200:
            leagues = res.json()
            if leagues:
                # Assuming the first league is the desired one
                start_league_id = leagues[0]['league_id']
                print(f"Found current season league ID: {start_league_id}")
                
                league_ids = find_league_history(start_league_id)
                
                config = {
                    "years": sorted(list(league_ids.keys()), reverse=True),
                    "logoUrl": LEAGUE_LOGO_URL,
                    "lastUpdated": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
                }
                with open("config.json", "w") as f:
                    json.dump(config, f)
                print("config.json has been generated.")

                for year, league_id in league_ids.items():
                    generate_data_file_for_year(year, league_id)
            else:
                print(f"No leagues found for user {USER_ID} in {CURRENT_YEAR}.")
        else:
            print(f"Could not fetch leagues for user. Status: {res.status_code}")
    except Exception as e:
        print(f"An error occurred during main execution: {e}")
