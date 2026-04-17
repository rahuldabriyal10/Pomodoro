// tests/timer.test.js
import { describe, it, expect } from 'vitest';

// Simulating your app's core configuration and time conversion logic for testing
const MODES = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };

function calculateTimeUnits(timeRemaining) {
    const m = Math.floor(timeRemaining / 60);
    const s = timeRemaining % 60;
    return { 
        minutes: String(m).padStart(2, "0"), 
        seconds: String(s).padStart(2, "0") 
    };
}

function calculateProgress(timeRemaining, totalTime) {
    return ((totalTime - timeRemaining) / totalTime) * 100;
}

describe('Pomodoro Core Logic Verification', () => {
    it('Should correctly format seconds into mm:ss strings', () => {
        const focusTime = calculateTimeUnits(MODES.focus);
        expect(focusTime.minutes).toBe("25");
        expect(focusTime.seconds).toBe("00");

        const edgeCaseTime = calculateTimeUnits(65);
        expect(edgeCaseTime.minutes).toBe("01");
        expect(edgeCaseTime.seconds).toBe("05");
    });

    it('Should calculate progress percentage accurately', () => {
        const halfTimeRemaining = 12.5 * 60; // 12.5 mins
        const progress = calculateProgress(halfTimeRemaining, MODES.focus);
        expect(progress).toBe(50);

        const emptyTime = calculateProgress(0, MODES.focus);
        expect(emptyTime).toBe(100);
    });

    it('Should strictly map initialization times to configuration', () => {
        expect(MODES.focus).toBe(1500);
        expect(MODES.short).toBe(300);
        expect(MODES.long).toBe(900);
    });
});