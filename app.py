import os
import pandas as pd
import plotly.express as px
from sleeperpy import Leagues, Players
from datetime import datetime
import json
import requests
import data_fetcher

# --- Configuration ---
# This is the starting point for finding your league history.
# Ensure this is the league ID for the most current season (e.g., 2025).
LEAGUE_ID = "1052601214833274880" 
LEAGUE_LOGO_URL = "https://i.imgur.com/uCkJvgd.png"

def find_league_history(start_league_id, num_years=3):
# ... existing code ...
    if standings_df.empty or not roster_map:
        print(f"No standings or roster data found for {year}. Skipping file generation.")
        return

    fdvoa_df = data_fetcher.calculate_fdvoa(league_id, roster_map, current_week)
    
# ... existing code ...
        teams = [{"Team": v['display_name'], "Avatar": f"https://sleepercdn.com/avatars/thumbs/{v['avatar']}" if v.get('avatar') else "https://placehold.co/50x50/EBF4FF/76A9FA?text=?", "F-DVOA (%)": 0} for v in roster_map.values()]
        fdvoa_df_with_avatars = pd.DataFrame(teams)


    power_rankings_df = data_fetcher.calculate_power_rankings(standings_df, fdvoa_df, current_week)
    
    is_current = year == str(datetime.now().year)

    if is_current:
        nfl_state = data_fetcher.get_live_game_status()
        analysis_week = nfl_state.get("week", 1)
    else:
        analysis_week = current_week
    
    rosters_df = data_fetcher.get_analysis_data(league_id, roster_map, analysis_week, year, season_type)
    
    analysis_type = "scores" if is_current else "averages"

    weekly_scores_data = {}
    if not is_current:
        raw_weekly_scores = data_fetcher.get_weekly_scores_for_season(league_id, roster_map)
# ... existing code ...
