
import { generateNormalizedFilename } from './src/lib/normalization-utils';

const testCases = [
    { date: '2026-03-01', merchant: 'Lucky', category: 'RECEIPT', originalName: 'Luckybill.jpg' },
    { date: '03/01/2026', merchant: 'Lucky', category: 'RECEIPT', originalName: 'Luckybill.jpg' },
    { date: 'March 1, 2026', merchant: 'Lucky', category: 'RECEIPT', originalName: 'Luckybill.jpg' },
    { date: null, merchant: 'Lucky', category: 'RECEIPT', originalName: 'Luckybill.jpg' },
];

testCases.forEach(tc => {
    console.log(`Input Date: ${tc.date} -> Normalized: ${generateNormalizedFilename(tc)}`);
});
