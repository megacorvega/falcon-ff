import os
import sys
import pandas as pd
import plotly.express as px
from sleeperpy import Leagues, Players
from datetime import datetime
import json
import requests
import data_fetcher

# --- Configuration ---
LEAGUE_ID = "1052601214833274880" 
LEAGUE_LOGO_URL = "https://i.imgur.com/uCkJvgd.png"

# --- NEW: Use absolute paths for file operations ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

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
        teams = [{"Team": v['display_name'], "Avatar": f"https://sleepercdn.com/avatars/thumbs/{v['avatar']}" if v.get('avatar') else "https://placehold.co/50x50/EBF4FF/76A9FA?text=?", "F-DVOA (%)": 0} for v in roster_map.values()]
        fdvoa_df_with_avatars = pd.DataFrame(teams)

    power_rankings_df = data_fetcher.calculate_power_rankings(standings_df, fdvoa_df, current_week)
    
    is_current = year == str(datetime.now().year)
    analysis_week = data_fetcher.get_live_game_status().get("week", 1) if is_current else current_week
    rosters_df = data_fetcher.get_analysis_data(league_id, roster_map, analysis_week, year, season_type)
    
    analysis_type = "scores" if is_current else "averages"
    weekly_scores_data = {}
    if not is_current:
        raw_weekly_scores = data_fetcher.get_weekly_scores_for_season(league_id, roster_map)
        weekly_scores_data = {roster_map[rid]['display_name']: scores for rid, scores in raw_weekly_scores.items() if rid in roster_map}

    year_data = {
        "lastUpdated": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
        "power_rankings": power_rankings_df.to_dict(orient='records'),
        "fdvoa": fdvoa_df_with_avatars.to_dict(orient='records'),
        "rosters": rosters_df.to_dict(orient='records'),
        "projection_week": analysis_week,
        "analysis_type": analysis_type,
        "weekly_scores": weekly_scores_data
    }
    
    file_path = os.path.join(SCRIPT_DIR, f"data_{year}.json")
    with open(file_path, "w") as f:
        json.dump(year_data, f, indent=4)
    
    print(f"--- Finished generating {file_path} ---")

def main():
    """Main execution function."""
    print(f"Starting data fetch for league: {LEAGUE_ID}")
    league_ids = find_league_history(LEAGUE_ID)
    
    if not league_ids:
        print("Could not find league history. Please check the LEAGUE_ID.")
        return

    print("Deleting old data files to ensure a clean refresh...")
    for year in league_ids.keys():
        file_path = os.path.join(SCRIPT_DIR, f"data_{year}.json")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"Successfully deleted {file_path}")
            except OSError as e:
                print(f"Error deleting {file_path}: {e}")
    
    config_path = os.path.join(SCRIPT_DIR, "config.json")
    if os.path.exists(config_path):
        try:
            os.remove(config_path)
            print(f"Successfully deleted {config_path}")
        except OSError as e:
            print(f"Error deleting {config_path}: {e}")

    config = {
        "years": sorted(list(league_ids.keys()), reverse=True),
        "logoUrl": LEAGUE_LOGO_URL,
        "lastUpdated": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    }
    with open(config_path, "w") as f:
        json.dump(config, f)
    print("config.json has been generated.")

    for year, league_id in league_ids.items():
        generate_data_file_for_year(year, league_id)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # --- NEW: Catch all exceptions and exit with an error code ---
        print(f"An unexpected error occurred during script execution: {e}")
        traceback.print_exc()
        sys.exit(1)


