// SEO copy for the hub and each sub-topic page. This text sits under the game.

export interface PageContent {
  topic: string; // logic topic id
  slug: string; // '' = hub
  title: string; // <title>
  description: string; // meta description
  h1: string;
  intro: string;
  how: string[];
  tips: string[];
  faq: { q: string; a: string }[];
}

export const PAGES: PageContent[] = [
  {
    topic: 'mixed',
    slug: '',
    title: 'Mental Math Sprint: free 60-second math speed game',
    description: 'A free daily mental math game for teens and adults. Solve as many problems as you can in 60 seconds, build a streak and share your score. No sign-up.',
    h1: 'Mental Math Sprint',
    intro: 'Solve as many problems as you can in 60 seconds. A new Daily Launch every day, the same for everyone, so you can compare scores with friends.',
    how: [
      'Type the answer and it submits by itself, no Enter key. Get it right and the next problem appears instantly.',
      'The heat meter tracks your streak. The hotter it gets, the harder the problems. Miss one and it cools down.',
      'Play the Daily Launch once a day to grow your streak, then practice, defuse the bomb or try Real Life Math.',
    ],
    tips: [
      'Break numbers apart: 47 + 38 is 47 + 30 + 8.',
      'For × 5, multiply by 10 and halve it: 18 × 5 = 180 ÷ 2 = 90.',
      'Speed comes from accuracy. A miss costs more time than a careful answer.',
    ],
    faq: [
      { q: 'Is Mental Math Sprint free?', a: 'Yes. Every mode is free to play in your browser, with no download and no account.' },
      { q: 'How is the score calculated?', a: 'Your score is the number of correct answers in 60 seconds. Combos add altitude to your rocket, which goes on your share card.' },
      { q: 'Is the daily puzzle the same for everyone?', a: 'Yes. Everyone gets the same Daily Launch problems each day (UTC), so scores are a fair comparison.' },
      { q: 'Does it save my progress?', a: 'Your streak, best scores and badges are saved in your browser on this device.' },
    ],
  },
  {
    topic: 'addition',
    slug: 'addition',
    title: 'Mental addition practice: fast adding game',
    description: 'Practice adding numbers in your head with a free timed game. Adaptive difficulty, quizzes, flashcards and printable addition worksheets.',
    h1: 'Mental addition practice',
    intro: 'Get faster at adding two-digit and three-digit numbers in your head. The game starts easy and heats up as you streak.',
    how: ['Pick a 30, 60 or 120 second round.', 'Answers submit automatically when they are right.', 'Missed problems are saved to your flashcards for review.'],
    tips: ['Add the tens first, then the ones: 56 + 27 = 76 + 7 = 83.', 'Round and fix: 49 + 36 is 50 + 36 − 1 = 85.', 'Look for pairs that make 10 or 100.'],
    faq: [
      { q: 'How do I add big numbers in my head?', a: 'Split them by place value. Add the hundreds, then tens, then ones, keeping a running total.' },
      { q: 'How long until I get faster?', a: 'Most people notice a speed jump within a week of daily 60-second rounds.' },
    ],
  },
  {
    topic: 'subtraction',
    slug: 'subtraction',
    title: 'Mental subtraction practice: fast subtraction game',
    description: 'Practice subtracting in your head with a free timed game, quizzes, flashcards and printable subtraction worksheets.',
    h1: 'Mental subtraction practice',
    intro: 'Train clean, fast subtraction without borrowing on paper. Difficulty adapts to how well you are doing.',
    how: ['Pick a round length.', 'Type the difference; it submits itself.', 'Streaks heat up the meter and bring bigger numbers.'],
    tips: ['Count up instead of down: 82 − 57 is 57 → 60 → 82, so 3 + 22 = 25.', 'Subtract a round number, then fix: 74 − 29 = 74 − 30 + 1 = 45.'],
    faq: [
      { q: "What's the fastest way to subtract in your head?", a: 'Counting up from the smaller number to the bigger one avoids borrowing and is usually faster.' },
      { q: 'Are there printable subtraction worksheets?', a: 'Yes. Open Worksheets, pick Subtraction and print. New numbers every time, answer key on page 2.' },
    ],
  },
  {
    topic: 'multiplication',
    slug: 'multiplication',
    title: 'Mental multiplication practice: times tables speed game for adults',
    description: 'Get faster at multiplication and times tables with a free timed game for teens and adults. Quizzes, flashcards and printable worksheets.',
    h1: 'Mental multiplication practice',
    intro: 'Times tables up to 15 and beyond, at your pace. Start with the basics and the heat meter pushes you to bigger numbers.',
    how: ['Pick a round length.', 'Multiply fast; answers submit themselves.', 'Missed facts go to your flashcards so you can clear them.'],
    tips: ['× 9: multiply by 10, subtract once. 9 × 7 = 70 − 7 = 63.', 'Double and halve: 16 × 5 = 8 × 10 = 80.', '× 11 for two digits: add the digits and put the sum in the middle. 11 × 34 = 374.'],
    faq: [
      { q: 'How can adults get better at times tables?', a: 'Short daily timed practice beats long sessions. Review the facts you miss with flashcards.' },
      { q: 'What numbers does it go up to?', a: 'It starts at small tables and climbs to about 15 × 25 as your heat rises.' },
    ],
  },
  {
    topic: 'division',
    slug: 'division',
    title: 'Mental division practice: fast division game',
    description: 'Practice dividing in your head with a free timed game. Every problem divides evenly. Quizzes, flashcards and printable division worksheets.',
    h1: 'Mental division practice',
    intro: 'Every problem divides evenly, so you can focus on speed. Division is just multiplication backwards.',
    how: ['Pick a round length.', 'Type the answer; it submits itself.', 'The heat meter raises the numbers as you streak.'],
    tips: ['Ask "what times this gives that?": 84 ÷ 7 → 7 × 12 = 84.', 'Halve twice to divide by 4: 96 ÷ 4 = 48 ÷ 2 = 24.'],
    faq: [
      { q: 'How do I divide quickly in my head?', a: 'Turn it into a multiplication question and use the times tables you already know.' },
      { q: 'Are there remainders?', a: 'No. Every problem in the game divides evenly.' },
    ],
  },
  {
    topic: 'percentages',
    slug: 'percentages',
    title: 'Percentage practice: find percent of a number fast',
    description: 'Learn to calculate percentages in your head. Free timed game, quizzes, flashcards and printable percentage worksheets.',
    h1: 'Percentage practice',
    intro: 'Work out 15% of 80 or 35% of 60 in seconds. Useful for tips, discounts, grades and taxes.',
    how: ['Pick a round length.', 'Every answer is a whole number.', 'Easy percents first (10%, 50%), then 15%, 35%, 120% as you heat up.'],
    tips: ['10% is moving the decimal: 10% of 70 is 7.', '5% is half of 10%. 15% is 10% plus 5%.', 'Flip it: 8% of 50 is the same as 50% of 8 = 4.'],
    faq: [
      { q: 'How do I calculate a percentage of a number in my head?', a: 'Find 10% first, then build up: 30% is three times 10%, 5% is half of 10%.' },
      { q: 'Is there a trick for any percentage?', a: 'Yes: x% of y equals y% of x. Use whichever side is easier.' },
    ],
  },
  {
    topic: 'real-life',
    slug: 'real-life-math',
    title: 'Real life math practice: tips, splitting the bill, discounts',
    description: 'Practice everyday money math: tip calculations, splitting a bill, sale prices and making change. Free timed game and printable worksheets.',
    h1: 'Real Life Math',
    intro: 'The math you actually use: tipping, splitting the check, working out sale prices and change. On receipts, against the clock.',
    how: ['Each receipt is a real situation.', 'Answers are whole dollars.', 'Score as many as you can in 90 seconds.'],
    tips: ['20% tip: move the decimal for 10%, then double. $45 → $4.50 → $9.', '25% off is the same as paying 75%. Quarter it, then subtract.', 'For change, count up from the total to the bill you paid.'],
    faq: [
      { q: 'How do I calculate a tip in my head?', a: 'Find 10% by moving the decimal one place. Double it for 20%, add half of it for 15%.' },
      { q: 'How do I split a bill quickly?', a: 'Divide the total by the number of people. Round the bill to a friendly number first if needed.' },
    ],
  },
];

export const pageFor = (slug: string) => PAGES.find((p) => p.slug === slug);
