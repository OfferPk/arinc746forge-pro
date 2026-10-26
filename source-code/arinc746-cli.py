#!/usr/bin/env python3
"""
ARINC746Forge Pro — Standalone Python 3 CLI Runner & CTU Call Switch
Cabin Communications System (CCS) & In-Flight Telephony
Standards: ARINC Characteristic 746, RTCA DO-262, FAA AC 20-140C
"""

import sys
import json
import time

class ARINC746Simulator:
    def __init__(self):
        self.tail = "A6-EGA"
        self.flight = "UAE746"
        self.aircraft = "Boeing 777-300ER"

        # Channels: Ch1 (Cockpit priority 1), Ch2 (Cabin voice), Ch3 (Iridium voice)
        self.channels = {
            "SAT-1": {"status": "IDLE", "priority": 1, "call": None},
            "SAT-2": {"status": "BUSY", "priority": 3, "call": {"station": "SEAT_12A", "dest": "+1-212-555-0199"}},
            "IRD-1": {"status": "BUSY", "priority": 3, "call": {"station": "SEAT_34K", "dest": "+44-20-7946-0912"}}
        }
        self.preemptions_count = 0
        self.calls_count = 2

    def trigger_flight_deck_preemption(self, dialed="+1-800-FAA-ATC1"):
        """Flight deck priority 1 call preempts lower priority passenger calls when channels full"""
        self.calls_count += 1
        # Check if Ch1 available
        if self.channels["SAT-1"]["status"] == "IDLE":
            self.channels["SAT-1"]["status"] = "BUSY"
            self.channels["SAT-1"]["call"] = {"station": "COCKPIT", "dest": dialed}
            return {"status": "CONNECTED_DIRECT", "ch": "SAT-1"}
        
        # Preempt SAT-2
        preempted_call = self.channels["SAT-2"]["call"]
        self.channels["SAT-2"]["status"] = "BUSY"
        self.channels["SAT-2"]["call"] = {"station": "COCKPIT", "dest": dialed}
        self.preemptions_count += 1
        return {"status": "CONNECTED_PREEMPTED", "ch": "SAT-2", "preempted": preempted_call}

    def generate_arinc429_words(self):
        # Label 270 (Octal 270 = Hex 0xB8): CTU Status & Active Lines
        label270 = 0xB8
        busy_count = sum(1 for c in self.channels.values() if c["status"] == "BUSY")
        preempt_bit = 1 if self.preemptions_count > 0 else 0

        data270 = ((busy_count & 0x07) << 10) | ((preempt_bit & 0x01) << 14) | (1 << 15) | (6 << 16) | (0x03 << 28)
        w270 = (data270 & 0x7FFFFF00) | label270
        w270 = self.apply_odd_parity(w270)

        # Label 271 (Octal 271 = Hex 0xB9): Cabin Call Activity & Preemption
        label271 = 0xB9
        data271 = ((self.calls_count & 0x1F) << 10) | ((self.preemptions_count & 0x3F) << 16) | (0x03 << 28)
        w271 = (data271 & 0x7FFFFF00) | label271
        w271 = self.apply_odd_parity(w271)

        return {
            "label270": {"octal": "270", "hex": hex(w270), "parity": self.verify_odd_parity(w270)},
            "label271": {"octal": "271", "hex": hex(w271), "parity": self.verify_odd_parity(w271)}
        }

    def apply_odd_parity(self, word):
        bits = word & 0x7FFFFFFF
        count = bin(bits).count('1')
        if count % 2 == 0:
            bits |= (1 << 31)
        return bits

    def verify_odd_parity(self, word):
        return bin(word).count('1') % 2 == 1

def run_cli():
    sim = ARINC746Simulator()
    print("=" * 70)
    print("ARINC746Forge Pro — Cabin Communications System (CCS / CTU) CLI")
    print("Standards: ARINC Characteristic 746, RTCA DO-262, FAA AC 20-140C")
    print("=" * 70)
    print(f"\n[CABIN TELECOMMUNICATIONS STATUS: {sim.tail} / {sim.flight} ({sim.aircraft})]")
    for ch_name, data in sim.channels.items():
        call_str = f"In-Call with {data['call']['dest']} ({data['call']['station']})" if data['call'] else "IDLE (Available)"
        print(f"  Channel {ch_name:<7} : {data['status']:<8} | Priority {data['priority']} | {call_str}")

    print("\n[SIMULATING HIGH-PRIORITY FLIGHT DECK PREEMPTION]")
    res = sim.trigger_flight_deck_preemption("+1-800-FAA-ATC1")
    print(f"  Cockpit ATC Call Status: {res['status']} on Channel {res['ch']}")
    if "preempted" in res:
        print(f"  Preempted Passenger Call: {res['preempted']['station']} ({res['preempted']['dest']})")

    bus = sim.generate_arinc429_words()
    print("\n" + "-" * 70)
    print("ARINC 429 Discrete Avionics Bus Output (100 kbps):")
    print(f"  Label 270 (CTU System & Channels)   : {bus['label270']['hex']:<12} | Parity: {'VALID (PASS)' if bus['label270']['parity'] else 'FAIL'}")
    print(f"  Label 271 (Call Activity & Preempt) : {bus['label271']['hex']:<12} | Parity: {'VALID (PASS)' if bus['label271']['parity'] else 'FAIL'}")
    print("=" * 70)

if __name__ == "__main__":
    run_cli()
