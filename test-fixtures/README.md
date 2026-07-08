# Test fixture evidence photos

One representative photo per report category, for driving real
submissions through the actual citizen API + AI pipeline during local
testing (not mock data — these exercise the real Modal-hosted vision
model, duplicate detector, and fraud scorer).

All images are from Wikimedia Commons (freely licensed), fetched via
their public search API. Most are India-specific since this platform's
demo context is India (wards/districts, Indian mobile numbers).
`road_damage` and `water_leakage` don't have a good India-tagged match
on Commons within reasonable search effort, so those two stay as
generic real photos of the same defect type. Local-only — see
`.gitignore` in this folder.

| file                          | category         | source                                                                                                                          |
|--------------------------------|------------------|----------------------------------------------------------------------------------------------------------------------------------|
| evidence/dead_animal.jpg       | dead_animal      | https://commons.wikimedia.org/wiki/File:Dead_animal_on_Rozoda_road.jpg |
| evidence/encroachment.jpg      | encroachment     | https://commons.wikimedia.org/wiki/File:Hawkers_in_Kolkata_10.jpg |
| evidence/garbage.jpg           | garbage          | https://commons.wikimedia.org/wiki/File:A_burning_roadside_garbage_dump_at_Panvel_Naka_near_Mumbai.jpg |
| evidence/illegal_dumping.jpg   | illegal_dumping  | https://commons.wikimedia.org/wiki/File:Charkop_Dumping.JPG |
| evidence/illegal_parking.jpg   | illegal_parking  | https://commons.wikimedia.org/wiki/File:Cars_illegally_parked_on_bicycle_lane_in_Kothaguda,_Hyderabad,_Telangana.jpg |
| evidence/open_drain.jpg        | open_drain       | https://commons.wikimedia.org/wiki/File:Drain_yet_to_build_(1).jpg |
| evidence/pothole.jpg           | pothole          | https://commons.wikimedia.org/wiki/File:Potholed_road_outside_Kolkata_Airport.jpg |
| evidence/road_damage.jpg       | road_damage      | https://commons.wikimedia.org/wiki/File:002_Damaged_road_surface_background_-_cracked_asphalt_blacktop_in_Spain.jpg (not India-specific) |
| evidence/streetlight.jpg       | streetlight      | https://commons.wikimedia.org/wiki/File:Electric_Pole_Inakanahalli_Coorg_Jun24_A7CR_01423.jpg |
| evidence/water_leakage.jpg     | water_leakage    | https://commons.wikimedia.org/wiki/File:Blue_stripe_indicating_leaking_water_pipe,_Churchland_Lane_-_geograph.org.uk_-_7250485.jpg (not India-specific) |

## Usage

Each report type's UUID (needed for `POST /api/v1/reports`) can be looked
up via `GET /api/v1/report-types`. Upload with:

```
curl -X POST http://127.0.0.1:8000/api/v1/reports/{report_id}/photos \
  -H "Authorization: Bearer <citizen token>" \
  -F "photos[]=@test-fixtures/evidence/garbage.jpg;type=image/jpeg"
```
