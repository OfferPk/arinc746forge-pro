# ARINC Characteristic 746 Engineering Specification

## Cabin Communications System (CCS) & Cabin Telecommunications Unit (CTU)

**Document Version:** 1.0.0 • **Status:** Approved for Implementation • **Standard Baseline:** ARINC 746, RTCA DO-262, FAA AC 20-140C, ARINC 429-19

---

### 1\. Executive Summary

ARINC Characteristic 746 defines the commercial avionics standard for the **Cabin Communications System (CCS)** and **Cabin Telecommunications Unit (CTU)**. It specifies the architecture for in-flight telephone, voice, data, and broadband in-flight connectivity (IFC) services delivered to airline passengers and cabin attendants while preserving strict safety isolation and guaranteed priority access for flight deck communications.

The CTU functions as an airborne Private Branch Exchange (PBX), dynamically arbitrating voice and data circuits across multiple satellite and air-to-ground radio bearers (Inmarsat Aero-H/H+, Iridium NEXT, and Ka/Ku-band broadband satellites).

ARINC746Forge Pro provides an avionics-grade software reference implementation of the CTU switching matrix, 3-tier priority arbitration queue with sub-500ms preemption, PCI-DSS compliant credit card payment tokenization, ARINC 429 discrete bus telemetry, and a 10-point normative compliance audit suite.

---

### 2\. Normative Industry Standards Baseline

1. **ARINC Characteristic 746**: *Cabin Communications System (CCS)* — Architecture of CTU line-replaceable units (LRUs), Seat Terminal Units (STUs), Cabin Distribution Networks (CDN), and standard ARINC 429 bus signaling.  
2. **RTCA DO-262**: *Minimum Operational Performance Standards for Avionics Supporting Next Generation Satellite Systems (NGSS)* — Standards for aeronautical satellite voice and packet data communication transceivers.  
3. **FAA Advisory Circular AC 20-140C**: *Guidelines for Design Approval of Aircraft Data Link Communication Systems Supporting Air Traffic Services (ATS)* — Mandates safety isolation and preemption priority for air traffic communications over passenger telecommunications.  
4. **ARINC 429-19**: *Mark 33 Digital Information Transfer System* — Discrete word formats, bitfield architectures, and Bit 32 odd parity.

---

### 3\. Multi-Bearer Architecture & Channel Hierarchy

The CTU arbitrates across four primary external telecommunication channels:

- **SAT-1 (Voice Safety Channel)**: Inmarsat Aero-H+ voice circuit dedicated to Priority 1 (Flight Deck / ATC safety communications).  
- **SAT-2 (Voice Cabin Channel 1\)**: Inmarsat Aero-H+ voice circuit available for Priority 3 (Passenger in-flight commercial telephony) and Priority 2 (Cabin crew operational intercom).  
- **IRD-1 (Voice Cabin Channel 2\)**: Iridium NEXT low-latency voice circuit serving commercial cabin calls.  
- **SAT-DATA (Broadband IFC Channel)**: High-throughput Ka/Ku-band satellite link delivering 45+ Mbps broadband capacity for passenger personal electronic devices (PEDs) and in-flight payment transaction processing.

---

### 4\. 3-Tier Priority Queue & Sub-500ms Preemption Logic

Under FAA AC 20-140C and ARINC 746 §4.2, available RF bandwidth is allocated according to strict deterministic priority rules:

- **Priority 1 (Flight Deck ATC & Emergency Voice)**: Flight deck crew access has absolute preemption authority over all satellite channels. If all voice channels are occupied by passenger calls, initiating a flight deck call triggers immediate hardware preemption within 500ms, terminating the lowest-priority passenger call and locking the channel for cockpit audio.  
- **Priority 2 (Cabin Attendant Operational & Service Calls)**: Purser and galley attendant intercom and ground operational coordination calls.  
- **Priority 3 (Commercial Passenger Telephony)**: Revenue calls initiated by passengers from Seat Terminal Units (STUs).

---

### 5\. Credit Card Pre-Authorization & PCI-DSS Tokenization

For commercial passenger telephony (Priority 3 calls), the CTU incorporates an integrated payment authorization gate:

- Ingests card swipe / EMV chip data from handset card readers.  
- Transmits secure cryptographically hashed pre-authorization requests over the SAT-DATA broadband link to ground payment clearinghouses.  
- Enforces PCI-DSS tokenization without storing unencrypted Primary Account Numbers (PAN) on the airborne LRU file systems.

---

### 6\. ARINC 429 Discrete Bus Output Specification

The CTU broadcasts two dedicated ARINC 429 words on the cabin and cockpit avionics bus at high speed (100 kbps) with **Bit 32 Odd Parity**:

#### Label 270 (Octal 270 / Hex 0xB8): CTU System Status & Line Allocation

- **Bits 1–8**: ARINC 429 Label `270` (Hex `B8`).  
- **Bits 9–10**: SDI (`00` \= All/System).  
- **Bits 11–13**: Active Voice Channels in Use (\$0–4\$).  
- **Bit 14**: Reserved.  
- **Bit 15**: Preemption Event Active flag (`1` \= Preemption Occurred).  
- **Bit 16**: Broadband IFC Link Online flag (`1` \= Online).  
- **Bits 17–22**: Connected Handset / STU Count (\$0–63\$).  
- **Bits 23–28**: Reserved.  
- **Bits 29–30**: SSM (`11` \= Normal Operation).  
- **Bit 32**: Odd Parity bit.

#### Label 271 (Octal 271 / Hex 0xB9): Cabin Call Activity & Preemption Alert

- **Bits 1–8**: ARINC 429 Label `271` (Hex `B9`).  
- **Bits 9–10**: SDI (`00`).  
- **Bits 11–15**: Active Call Count (\$0–31\$).  
- **Bit 16**: Reserved.  
- **Bits 17–22**: Cumulative Preemption Event Counter (\$0–63\$).  
- **Bits 23–28**: Reserved.  
- **Bits 29–30**: SSM (`11` \= Normal).  
- **Bit 32**: Odd Parity bit.