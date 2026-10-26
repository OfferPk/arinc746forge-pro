/**
 * ARINC746Forge Pro — Core Engine
 * Cabin Communications System (CCS / CTU) & In-Flight Connectivity (IFC)
 * Standards: ARINC Characteristic 746, RTCA DO-262, FAA AC 20-140C
 */

class ARINC746Engine {
  constructor() {
    this.systemInfo = {
      tailNumber: 'A6-EGA',
      flightNumber: 'UAE746',
      aircraftType: 'Boeing 777-300ER',
      ctuModel: 'Collins / Honeywell CCS-746',
      firmwareVersion: '1.0.0-PRO'
    };

    // Physical Satellite & Broadband Bearer Channels (ARINC 746 §3.2)
    this.bearers = {
      satcomCh1: { id: 'SAT-1', type: 'AERO_H_PLUS_VOICE', status: 'IDLE', activeCallId: null, priorityLimit: 1 },
      satcomCh2: { id: 'SAT-2', type: 'AERO_H_PLUS_VOICE', status: 'IDLE', activeCallId: null, priorityLimit: 3 },
      iridiumCh3: { id: 'IRD-1', type: 'IRIDIUM_NEXT_VOICE', status: 'IDLE', activeCallId: null, priorityLimit: 3 },
      broadbandCh4: { id: 'SAT-DATA', type: 'KA_BAND_BROADBAND', status: 'ONLINE', bandwidthMbps: 45.0 }
    };

    // Seat Terminal Units (STUs) & Cabin Handset Stations
    this.stations = {
      'COCKPIT': { name: 'Flight Deck Cockpit Audio', priority: 1, state: 'ON_HOOK' },
      'FWD_GALLEY': { name: 'Forward Cabin Attendant', priority: 2, state: 'ON_HOOK' },
      'AFT_GALLEY': { name: 'Aft Cabin Attendant', priority: 2, state: 'ON_HOOK' },
      'SEAT_12A': { name: 'First Class Seat 12A Handset', priority: 3, state: 'ON_HOOK' },
      'SEAT_34K': { name: 'Business Class Seat 34K Handset', priority: 3, state: 'ON_HOOK' },
      'SEAT_58C': { name: 'Economy Class Seat 58C Handset', priority: 3, state: 'ON_HOOK' }
    };

    // Call Registry & Billing
    this.activeCalls = new Map();
    this.callHistory = [];
    this.stats = {
      callsCompleted: 0,
      callsPreempted: 0,
      totalDurationSec: 0,
      totalRevenueUsd: 0.0
    };

    // Initial default test call
    this.initiateCall('SEAT_12A', '+1-212-555-0199', '4111-XXXX-XXXX-1111');
  }

  initiateCall(stationId, dialedNumber, paymentToken = null) {
    const station = this.stations[stationId];
    if (!station) return { error: 'INVALID_STATION' };

    const callId = `CALL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const call = {
      callId: callId,
      stationId: stationId,
      stationName: station.name,
      priority: station.priority,
      dialedNumber: dialedNumber,
      paymentToken: paymentToken || (station.priority === 3 ? 'PRE_AUTH_OK' : 'N/A_AIRLINE'),
      state: 'DIALING', // DIALING, CONNECTED, PREEMPTED, TERMINATED
      bearerAssigned: null,
      startTime: new Date().toISOString(),
      durationSec: 0
    };

    // Channel Allocation with Priority Arbitration (ARINC 746 §4.2)
    const assignedBearer = this.allocateBearer(call);
    if (!assignedBearer) {
      call.state = 'BUSY_ALL_CHANNELS';
      this.callHistory.unshift(call);
      return { error: 'ALL_CHANNELS_BUSY', call: call };
    }

    call.bearerAssigned = assignedBearer;
    call.state = 'CONNECTED';
    this.bearers[assignedBearer].status = 'BUSY';
    this.bearers[assignedBearer].activeCallId = callId;
    station.state = 'OFF_HOOK';

    this.activeCalls.set(callId, call);
    this.callHistory.unshift(call);
    if (this.callHistory.length > 20) this.callHistory.pop();

    return { status: 'CONNECTED', call: call };
  }

  allocateBearer(newCall) {
    // 1. Try finding an idle voice bearer
    for (const bKey of ['satcomCh1', 'satcomCh2', 'iridiumCh3']) {
      const b = this.bearers[bKey];
      if (b.status === 'IDLE' && newCall.priority <= b.priorityLimit) {
        return bKey;
      }
    }

    // 2. High-Priority Preemption (Flight Deck overrides passenger calls)
    if (newCall.priority === 1) {
      // Find lowest priority active call to preempt
      let lowestCall = null;
      let targetBearer = null;

      for (const bKey of ['satcomCh2', 'iridiumCh3', 'satcomCh1']) {
        const b = this.bearers[bKey];
        if (b.status === 'BUSY' && b.activeCallId) {
          const activeCall = this.activeCalls.get(b.activeCallId);
          if (activeCall && activeCall.priority > 1) {
            if (!lowestCall || activeCall.priority > lowestCall.priority) {
              lowestCall = activeCall;
              targetBearer = bKey;
            }
          }
        }
      }

      if (lowestCall && targetBearer) {
        this.preemptCall(lowestCall.callId);
        return targetBearer;
      }
    }

    return null;
  }

  preemptCall(callId) {
    const call = this.activeCalls.get(callId);
    if (call) {
      call.state = 'PREEMPTED';
      this.stats.callsPreempted++;
      if (call.bearerAssigned && this.bearers[call.bearerAssigned]) {
        this.bearers[call.bearerAssigned].status = 'IDLE';
        this.bearers[call.bearerAssigned].activeCallId = null;
      }
      this.stations[call.stationId].state = 'ON_HOOK';
      this.activeCalls.delete(callId);
    }
  }

  terminateCall(callId) {
    const call = this.activeCalls.get(callId);
    if (call) {
      call.state = 'TERMINATED';
      this.stats.callsCompleted++;
      if (call.bearerAssigned && this.bearers[call.bearerAssigned]) {
        this.bearers[call.bearerAssigned].status = 'IDLE';
        this.bearers[call.bearerAssigned].activeCallId = null;
      }
      this.stations[call.stationId].state = 'ON_HOOK';
      this.activeCalls.delete(callId);
      return true;
    }
    return false;
  }

  stepTimer(dtSec = 1) {
    for (const call of this.activeCalls.values()) {
      call.durationSec += dtSec;
      this.stats.totalDurationSec += dtSec;
      if (call.priority === 3) {
        this.stats.totalRevenueUsd += (2.50 / 60) * dtSec;
      }
    }
  }

  // --- ARINC 429 Discrete Bus Synthesis ---
  generateARINC429Words() {
    // Label 270 (Octal 270, Hex 0xB8): CTU System Status & Line Allocation
    const label270 = 0xB8;
    let data270 = 0;

    let activeChannels = 0;
    for (const bKey of ['satcomCh1', 'satcomCh2', 'iridiumCh3']) {
      if (this.bearers[bKey].status === 'BUSY') activeChannels++;
    }

    const preemptionBit = this.stats.callsPreempted > 0 ? 1 : 0;
    const broadbandBit = this.bearers.broadbandCh4.status === 'ONLINE' ? 1 : 0;
    const connectedHandsets = Object.keys(this.stations).length;

    data270 |= (activeChannels & 0x07) << 10;       // Bits 11-13: Active voice channels in use
    data270 |= (preemptionBit & 0x01) << 14;        // Bit 15: Preemption event flag
    data270 |= (broadbandBit & 0x01) << 15;         // Bit 16: Broadband IFC link online
    data270 |= (connectedHandsets & 0x3F) << 16;    // Bits 17-22: Connected handset count
    data270 |= 0x03 << 28;                          // Bits 29-30: SSM (Normal Operation)

    let word270 = (data270 & 0x7FFFFF00) | (label270 & 0xFF);
    word270 = this.applyOddParity(word270);

    // Label 271 (Octal 271, Hex 0xB9): Cabin Call Activity & Preemption Alert
    const label271 = 0xB9;
    let data271 = 0;

    const activeCallCount = this.activeCalls.size;
    const preemptCount = Math.min(63, this.stats.callsPreempted);

    data271 |= (activeCallCount & 0x1F) << 10;      // Bits 11-15: Active call count
    data271 |= (preemptCount & 0x3F) << 16;         // Bits 17-22: Preemption counter
    data271 |= 0x03 << 28;                          // Bits 29-30: SSM

    let word271 = (data271 & 0x7FFFFF00) | (label271 & 0xFF);
    word271 = this.applyOddParity(word271);

    return {
      label270: {
        octal: '270',
        hex: '0x' + (word270 >>> 0).toString(16).toUpperCase().padStart(8, '0'),
        parity: this.verifyOddParity(word270),
        activeChannels: activeChannels,
        broadbandOnline: broadbandBit === 1
      },
      label271: {
        octal: '271',
        hex: '0x' + (word271 >>> 0).toString(16).toUpperCase().padStart(8, '0'),
        parity: this.verifyOddParity(word271),
        activeCallCount: activeCallCount,
        preemptCount: preemptCount
      }
    };
  }

  applyOddParity(word32) {
    let bits = word32 & 0x7FFFFFFF;
    let count = 0;
    for (let i = 0; i < 31; i++) {
      if ((bits >> i) & 1) count++;
    }
    if (count % 2 === 0) {
      bits |= (1 << 31);
    }
    return bits >>> 0;
  }

  verifyOddParity(word32) {
    let count = 0;
    for (let i = 0; i < 32; i++) {
      if ((word32 >>> i) & 1) count++;
    }
    return count % 2 === 1;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ARINC746Engine };
}
