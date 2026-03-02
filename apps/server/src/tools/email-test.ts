import { sendVerificationEmail, sendQuizResultEmail, generateOTP } from '../services/email';

type TestResult = { name: string; ok: boolean };

async function runCase(name: string, fn: () => Promise<boolean>): Promise<TestResult> {
  try {
    const ok = await fn();
    console.log(JSON.stringify({ test: name, ok }));
    return { name, ok };
  } catch (e) {
    console.log(JSON.stringify({ test: name, ok: false, error: (e as any)?.message || String(e) }));
    return { name, ok: false };
  }
}

async function main() {
  const email = process.env.TEST_EMAIL || process.env.SMOKE_EMAIL || 'musaeleazar090@gmail.com';
  const name = process.env.TEST_NAME || process.env.SMOKE_NAME || 'Mail Test User';

  const otp = generateOTP();
  const results: TestResult[] = [];

  results.push(await runCase('verification_with_otp', () => sendVerificationEmail(email, name, undefined, otp)));
  results.push(await runCase('verification_with_link', () =>
    sendVerificationEmail(email, name, process.env.TEST_VERIFY_URL || 'https://example.com/verify?token=dummy', undefined)
  ));

  const details = [
    { question: 'What is 2 + 2?', selectedOption: '4', correctOption: '4', isCorrect: true },
    { question: 'Capital of France?', selectedOption: 'Berlin', correctOption: 'Paris', isCorrect: false },
  ];
  results.push(await runCase('result_summary', () => sendQuizResultEmail(email, name, 78.5, details)));

  const passed = results.filter(r => r.ok).length;
  console.log(JSON.stringify({ summary: { passed, total: results.length } }));
}

main().catch(err => {
  console.error('fatal', err);
  process.exit(1);
});
