# SofaScore stat mapping

- `att_actions = shots + key_passes + successful_dribbles + touches_in_box`
- Applies to `FWD` and `MID`
- Threshold: `6`

- `def_actions = tackles_won + interceptions + clearances + blocks + saves`
- Applies to `DEF` and `GK`
- Threshold: `12`

- `clean_sheet = goals_conceded == 0 AND minutes_played >= 60`

## SofaScore field mapping

- `shots_on_target = onTargetScoringAttempt`
- `shots = onTargetScoringAttempt + shotOffTarget`
- `key_passes = keyPass`
- `successful_dribbles = successfulDribble`
- `touches_in_box = touchInBox`
- `tackles_won = wonTackle`
- `interceptions = interceptionWon`
- `clearances = totalClearance`
- `blocks = blockedScoringAttempt`
- `saves = saves`
- `minutes_played = minutesPlayed`
- `goals_conceded = goalsConceded`

## Lineups endpoint

- `https://api.sofascore.com/api/v1/event/{event_id}/lineups`
