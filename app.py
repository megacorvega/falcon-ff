import os
import pandas as pd
import plotly.express as px
from sleeperpy import Leagues, Players
from datetime import datetime
import json
import requests
import data_fetcher

# --- Configuration ---
# Replace with your Sleeper League ID for the CURRENT season
LEAGUE_ID = "1252517692607303680" 
# Replace with your league's logo URL
LEAGUE_LOGO_URL = "https://i.imgur.com/uCkJvgd.png"

def find_league_history(start_league_id, num_years=3):
    """Finds the last few years of a league's history."""
    league_ids = {}
    current_league_id = start_league_id
    
    for _ in range(num_years):
        try:
            res = requests.get(f"https://api.sleeper.app/v1/league/{current_league_id}")
            if res.status_code == 200:
                league_info = res.json()
                season = league_info.get("season")
                league_ids[season] = current_league_id
                current_league_id = league_info.get("previous_league_id")
                if not current_league_id:
                    break
            else:
                break
        except Exception as e:
            print(f"Could not fetch league history: {e}")
            break
    return league_ids

def generate_data_file_for_year(year, league_id):
    """Generates a single JSON data file for a specific year."""
    print(f"--- Generating data for {year} ---")
    
    standings_df, roster_map, current_week, season_type = data_fetcher.get_league_data(league_id, year)
    
    if standings_df.empty:
        print(f"No data found for {year}. Skipping file generation.")
        return

    fdvoa_df = data_fetcher.calculate_fdvoa(league_id, roster_map, current_week)
    
    avatar_df = standings_df[['Team', 'Avatar']].copy()
    fdvoa_df_with_avatars = pd.merge(fdvoa_df, avatar_df, on="Team", how="left") if not fdvoa_df.empty else avatar_df.assign(**{'F-DVOA (%)': 0})

    power_rankings_df = data_fetcher.calculate_power_rankings(standings_df, fdvoa_df, current_week)
    
    rosters_df = data_fetcher.get_analysis_data(league_id, roster_map, current_week, year, season_type)
    
    is_current = year == str(datetime.now().year)
    analysis_type = "scores" if is_current and current_week > 1 else "projections" if is_current else "averages"

    # Fetch weekly scores for past seasons for the box plot.
    weekly_scores_data = {}
    if not is_current:
        raw_weekly_scores = data_fetcher.get_weekly_scores_for_season(league_id, roster_map)
        # Map roster IDs to team names for the frontend
        weekly_scores_data = {roster_map[rid]['display_name']: scores for rid, scores in raw_weekly_scores.items() if rid in roster_map}

    year_data = {
        "power_rankings": power_rankings_df.to_dict(orient='records'),
        "fdvoa": fdvoa_df_with_avatars.to_dict(orient='records'),
        "rosters": rosters_df.to_dict(orient='records'),
        "projection_week": current_week,
        "analysis_type": analysis_type,
        "weekly_scores": weekly_scores_data # Add the new data
    }

    with open(f"data_{year}.json", "w") as f:
        json.dump(year_data, f, indent=4)
    
    print(f"--- Finished generating data_{year}.json ---")

if __name__ == "__main__":
    league_ids = find_league_history(LEAGUE_ID)
    
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
