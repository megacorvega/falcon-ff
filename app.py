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
    
    # Fetches standings, roster map, current week, and season type
    standings_df, roster_map, current_week, season_type = data_fetcher.get_league_data(league_id, year)
    
    if standings_df.empty:
        print(f"No data found for {year}. Skipping file generation.")
        return

    # Calculate F-DVOA ratings
    fdvoa_df = data_fetcher.calculate_fdvoa(league_id, roster_map, current_week)
    
    # Merge avatars with F-DVOA data for display
    avatar_df = standings_df[['Team', 'Avatar']].copy()
    fdvoa_df_with_avatars = pd.merge(fdvoa_df, avatar_df, on="Team", how="left") if not fdvoa_df.empty else avatar_df.assign(**{'F-DVOA (%)': 0})

    # Calculate power rankings
    power_rankings_df = data_fetcher.calculate_power_rankings(standings_df, fdvoa_df, current_week)
    
    projection_week = current_week
    
    # Get either projections (current year) or average scores (past years)
    rosters_df = data_fetcher.get_rosters_and_projections(league_id, roster_map, projection_week, year, season_type)
    
    # Consolidate all data for the year into a dictionary
    year_data = {
        "power_rankings": power_rankings_df.to_dict(orient='records'),
        "fdvoa": fdvoa_df_with_avatars.to_dict(orient='records'),
        "rosters": rosters_df.to_dict(orient='records'),
        "projection_week": projection_week,
        "is_current_season": year == str(datetime.now().year) # Add flag for frontend
    }

    # Save the consolidated data to a year-specific JSON file
    with open(f"data_{year}.json", "w") as f:
        json.dump(year_data, f, indent=4)
    
    print(f"--- Finished generating data_{year}.json ---")

if __name__ == "__main__":
    # Find the league history to generate files for multiple seasons
    league_ids = find_league_history(LEAGUE_ID)
    
    # Generate a configuration file for the frontend
    config = {
        "years": sorted(list(league_ids.keys()), reverse=True),
        "logoUrl": LEAGUE_LOGO_URL,
        "lastUpdated": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    }
    with open("config.json", "w") as f:
        json.dump(config, f)
    print("config.json has been generated.")

    # Generate data files for each year found in the league history
    for year, league_id in league_ids.items():
        generate_data_file_for_year(year, league_id)
