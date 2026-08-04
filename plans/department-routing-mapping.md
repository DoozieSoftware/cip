# Bengaluru Department Routing & Service Responsibility Master Reference

Status: **Approved for AI Categorization & Department-Wise Routing Implementation.**  
Scope: Department-wise civic complaint routing for Bengaluru Urban across municipal wings and state utility boards.  
Out of scope (deferred for future phase): Detailed ward-level assignment, location-based geofence routing, 1-to-1 officer mapping.

---

## 1. Primary & Secondary Civic Authorities Master Table

| Agency Name | Code | Agency Type | Official Helpline / Contact | Jurisdiction & Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Bruhat Bengaluru Mahanagara Palike** (under Greater Bengaluru Authority / GBA) | `BBMP` | Municipal Corporation | **1533** / Sahaaya 2.0 | Roads, footpaths, solid waste, streetlights, storm water drains, lakes, public parks, stray animals, public health, building permissions |
| **Bangalore Water Supply & Sewerage Board** | `BWSSB` | Water Utility | **1916** / WhatsApp 8762228888 | Potable water supply, pipeline leaks/bursts, sewage mains, sewer overflows, water contamination, water meters |
| **Bangalore Electricity Supply Company** | `BESCOM` | Power Utility | **1912** / WhatsApp 9449844640 | Grid power distribution, outages, high-tension/low-tension power lines, transformers, electric shock risks, meters *(Note: Streetlights belong to BBMP)* |
| **Bengaluru Traffic Police** | `BTP` | Traffic Police | **1095** / **112** / ASTraM App | Traffic violations, illegal parking/towing, traffic congestion, signal timing faults, auto/cab complaints, e-challans |
| **Karnataka State Pollution Control Board** | `KSPCB` | Regulatory Board | 080-25589112 | Industrial effluents, commercial noise pollution, major environmental violations |
| **Bangalore Metropolitan Transport Corporation** | `BMTC` | Transport Board | 1800-425-1663 | Bus shelters, bus stops, bus driver/conductor misconduct |
| **Karnataka Public Works Department** | `PWD` | State Highway Agency | 080-22211283 | State highways passing through Bengaluru metropolitan area |
| **Bangalore Development Authority** | `BDA` | Urban Planning | 080-23360825 | BDA layout parks/roads (prior to BBMP handover), BDA land encroachments |

---

## 2. BBMP Departmental Wing Breakdown (Sahaaya 2.0 Structure)

BBMP classifies grievances across specialized department wings. Each wing receives direct routing based on complaint categorization:

| BBMP Wing Name | Code | Specific Issues & Complaint Scope |
| :--- | :--- | :--- |
| **Road Maintenance (Engineering)** | `BBMP_ENG` | Potholes, road damage, damaged footpaths, footpath encroachment (structures), road cutting permissions, water stagnation on roads |
| **Solid Waste Management** | `BBMP_SWM` | Uncollected garbage, open garbage dumping, street sweeping, garbage burning, public dustbin overflow, dead animal disposal |
| **Electrical Works** | `BBMP_ELEC` | Non-functional streetlights, park lighting, streetlights on in daytime, exposed junction boxes on streetlight poles |
| **Storm Water Drain** | `BBMP_SWD` | SWD desilting, storm drain blockage, garbage in SWD, structural damage to storm drains |
| **Health Department** | `BBMP_HLTH` | Mosquito fogging/spraying, unhygienic eateries, public toilet sanitation, vector control |
| **Animal Husbandry** | `BBMP_AH` | Stray dog menace, dog bites, stray cattle/pigs, pet dog licensing |
| **Forest & Horticulture** | `BBMP_FOR` | Fallen trees, hazardous tree branches, tree pruning, snake/wildlife rescue coordination |
| **Town Planning** | `BBMP_TP` | Building bye-law violations, illegal construction, encroachment on public land |
| **Parks & Playgrounds** | `BBMP_PRK` | Park equipment damage, walking track damage, playground maintenance |
| **Lakes Department** | `BBMP_LAKE` | Lake encroachment, lake fencing, illegal sewage entry into lakes |

---

## 3. External Utility Authority Service Mapping

### 3.1 BWSSB (Water & Sewerage)
- **Water Supply**: Main line leaks, pipeline bursts, zero water supply, low water pressure, contaminated/dirty water supply.
- **Sewerage Infrastructure**: Overflowing manholes, blocked sewer lines, missing manhole covers, sewer line damage.
- **Billing & Metering**: Incorrect meter reading, billing disputes, new connection requests.

### 3.2 BESCOM (Electricity Supply)
- **Power Supply**: Grid power outages, low/high voltage fluctuations, phase failure.
- **Electrical Safety Hazards**: Dangling high-tension/low-tension power lines, transformer spark/explosion risk, leaning electrical poles, dangerous overhead wires.
- **Metering & Connections**: Meter burn/fault, billing issues, LT/HT service connections.

### 3.3 Bengaluru Traffic Police (BTP)
- **Enforcement & Parking**: Footpath parking, double-line parking, no-parking violations, vehicle towing requests.
- **Traffic Flow & Signals**: Broken traffic lights/signals, severe traffic gridlock/congestion, dangerous junction design.
- **Citizen Safety & Misconduct**: Auto-rickshaw driver refusal/overcharging, reckless driving, helmetless/wrong-way driving.

---

## 4. Master Complaint Category → Department Mapping Table (for AI Engine)

| Category Code | Display Category Name | Primary Department | Secondary Dept (CC / Co-owner) | Key AI Detection Keywords & Context |
| :--- | :--- | :--- | :--- | :--- |
| `pothole` | Road Pothole / Damage | `BBMP_ENG` | `BTP` (if on arterial road causing traffic) | pothole, road crater, tar damage, asphalt, road patch |
| `footpath_damage` | Damaged Footpath | `BBMP_ENG` | — | broken paver tiles, broken curb, footpath slab missing |
| `garbage` | Uncollected / Open Garbage | `BBMP_SWM` | — | garbage dump, black spot, trash heap, plastic waste, unpicked bin |
| `dead_animal` | Dead Animal Disposal | `BBMP_SWM` | `BBMP_AH` | dead dog, dead cat, carcass, animal disposal |
| `streetlight` | Non-Functional Streetlight | `BBMP_ELEC` | — | streetlight dark, lamp post off, dark road at night, streetlight pole |
| `power_outage` | Power Outage / Transformer | `BESCOM` | — | power cut, line drop, transformer spark, hanging electric line |
| `water_leakage` | Water Pipeline Burst / Leak | `BWSSB` | `BBMP_ENG` (if road eroded) | pipe burst, water leaking on road, drinking water waste |
| `sewage_overflow` | Sewage Overflow / Manhole | `BWSSB` | `BBMP_SWD` (if flowing into drain) | sewage leak, overflowing manhole, foul odor, black water |
| `drain_blockage` | Storm Water Drain Blockage | `BBMP_SWD` | `BBMP_SWM` | rajakuve, SWD overflow, storm drain silt, drain clogged |
| `traffic_violation` | Traffic Violation / Congestion | `BTP` | — | signal jump, wrong side driving, traffic jam, signal off |
| `illegal_parking` | Illegal / Footpath Parking | `BTP` | `BBMP_ENG` (if blocking footpath) | parked on footpath, double parking, blocking gate, no parking |
| `tree_fall` | Fallen Tree / Overhanging Branch | `BBMP_FOR` | `BESCOM` (if on power wires) | tree fallen, branch blocking road, tree pruning needed |
| `stray_animal` | Stray Dog / Animal Menace | `BBMP_AH` | — | stray dog pack, rabid dog, cattle on road, dog bite risk |
| `encroachment` | Public Property Encroachment | `BBMP_TP` | `BBMP_ENG` | footpath shop, illegal shed, property encroachment |
| `noise_pollution` | Industrial / Commercial Noise | `KSPCB` | `BTP` / Local Police | loud speaker, factory noise late night, generator noise |

---

## 5. Cross-Department Coordination Scenarios (Multi-Department Handling)

For complex civic issues requiring inter-agency action, the system assigns a **Primary Department** (owner of the ticket and primary resolution SLA) and a **Secondary Department** (receives a linked co-coordination task with its own SLA):

```
                       ┌─────────────────────────────────┐
                       │       Incoming Complaint        │
                       └────────────────┬────────────────┘
                                        │
                             AI Categorization Engine
                                        │
                   ┌────────────────────┴────────────────────┐
                   ▼                                         ▼
     Primary Department (Owner)             Secondary Department (CC / Co-owner)
     • Owns overall SLA & Status            • Responsible for specific sub-task
     • Directs main repair work             • E.g., Traffic control, Cable cut, Road restoration
```

### Multi-Department Coordination Matrix

| # | Scenario Description | Primary Dept | Secondary Dept | Operational Responsibility Division |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Pothole on major arterial road** causing heavy traffic gridlock | `BBMP_ENG` | `BTP` | **BBMP** fills/repairs the pothole; **BTP** manages traffic flow and places safety barricades during repair work. |
| **2** | **BWSSB water main burst** damaging road surface | `BWSSB` | `BBMP_ENG` | **BWSSB** fixes the subterranean water pipe leak; **BBMP** is notified to restore the damaged asphalt road layer after backfilling. |
| **3** | **Sewage overflowing into Storm Water Drain (Rajakaluve)** | `BWSSB` | `BBMP_SWD` | **BWSSB** stops the sewage line breach; **BBMP SWD** clears/desilts the contaminated storm water drain. |
| **4** | **Dangling telecom / power cables** causing road safety hazard | `BBMP_ELEC` | `BESCOM` | **BBMP Electrical** removes illegal/dangling optical fiber cables; **BESCOM** inspects and secures active power lines. |
| **5** | **Road excavation by utility (BWSSB/BESCOM)** left un-restored | `BBMP_ENG` | `BWSSB` / `BESCOM` | **BBMP** enforces road restoration penalty & oversees repaving; **Utility** must complete trench compaction. |
| **6** | **Fallen tree on power lines and blocking road** | `BBMP_FOR` | `BESCOM` | **BESCOM** isolates the power line for safety; **BBMP Forest** cuts and removes the fallen tree clear of the road. |
| **7** | **Illegal parking causing footpath destruction** | `BTP` | `BBMP_ENG` | **BTP** fines/tows illegally parked vehicles; **BBMP** repairs damaged footpath curbs/slabs. |
| **8** | **Streetlight failure at major traffic intersection** | `BBMP_ELEC` | `BTP` | **BBMP Electrical** replaces bulbs/panel; **BTP** deploys traffic personnel or temporary solar flashers for night safety. |

---

## 6. Architecture Alignment & Next Steps

1. **Admin Portal Reuse**: No separate admin portal is required. The existing **Super Admin Portal** will manage department configurations, AI prompt schemas, and routing rule DSL definitions.
2. **Location Routing Deferred**: Ward-level and location geofencing rules remain deferred as planned for a future release.
3. **AI Categorization Prompt Updates**: The AI vision and text categorization prompts will consume the `Category Code` to `Primary Department` / `Secondary Department` mappings documented in Section 4 and Section 5.
