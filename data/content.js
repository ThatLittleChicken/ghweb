// All site content, verbatim from the resume / design handoff.

export const INTRO = [
  'CS senior at Brigham Young University who builds things end to end and researches how networks shape inequality. Finishing ',
  'Dec 2026',
  ', looking for SWE roles and grad school.',
]

export const NAV = [
  ['/', 'Home'],
  ['/experience', 'Experience'],
  ['/education', 'Education'],
  ['/projects', 'Projects'],
  ['/awards', 'Awards'],
  ['/writing', 'Writing'],
]

export const DOORS = [
  { index: '01', count: '5 roles', label: 'Work', sub: 'Research at BYU, an AWS event pipeline at Partner.Co, and more.', href: '/experience' },
  { index: '02', count: '4 projects', label: 'Built', sub: 'From a serverless ChatGPT wrapper to a DQN that rewires networks.', href: '/projects' },
  { index: '03', count: '22 awards', label: 'Won', sub: 'ASEAN science fairs to the Malaysian Computing Challenge, 2016–2021.', href: '/awards' },
]

export const FOOT_LINKS = [
  ['yonggh@byu.edu', 'mailto:yonggh@byu.edu'],
  ['github', 'https://github.com/thatlittlechicken'],
  ['linkedin', 'https://www.linkedin.com/in/gentyong/'],
  ['instagram', 'https://instagram.com/genthoong'],
  ['spotify', 'https://open.spotify.com/user/22kf3sv5ir57t7v7jf3qm3upy'],
]

export const JOBS = [
  {
    when: 'Feb 2025 – present',
    title: 'Undergraduate Researcher',
    org: 'BYU · HCMI Lab & MTRIE Lab',
    points: [
      'Investigated poverty mitigation through RL by optimally rewiring networks using DQN with PyTorch, achieving results outperforming baseline.',
      'Built a consolidated multimodal language repository to reform CRUD operations for NLP training and linguistic research.',
    ],
  },
  {
    when: 'Apr – Aug 2026',
    title: 'Software Engineer Intern',
    org: 'Partner.Co · Lehi, UT',
    points: [
      'End-to-end event pipeline spanning event definition, database emission, API Gateway, EventBridge, SQS and Lambda, with DynamoDB idempotency handling and DLQs.',
      'Contributed to a Quarkus tracing extension that injects trace context into events, enabling annotation-driven end-to-end CloudWatch tracing.',
    ],
  },
  {
    when: 'May 2024 – Dec 2025',
    title: 'Web Developer',
    org: 'BYU',
    points: [
      'Maintained and improved the department site; created 100+ web pages.',
      'Built a Next.js + Pixi.js game with MySQL user data, hosted on the department IIS server for marketing events, reaching 2,000+ players.',
    ],
  },
  {
    when: 'Jan 2024 – Feb 2025',
    title: 'Makerspace Lab Technician',
    org: 'BYU',
    points: [
      'Backend queue automator integrating Google and Box APIs with Node.js webhooks on EC2, removing 90% of manual entries.',
      'Researched emerging technologies and tools for the university makerspace.',
    ],
  },
]

export const PROJECTS = [
  {
    title: 'ChatGPT Wrapper',
    tags: ['TypeScript', 'Next.js', 'OpenAI API', 'AWS', 'Tailwind'],
    desc: 'Tailored multimodal agents for real-world needs with file and web search. Serverless via CloudFront + Lambda, Cognito auth, SES email, Aurora and S3 storage.',
    cta: 'Case study',
    href: '#',
  },
  {
    title: 'Network rewiring with DQN',
    tags: ['PyTorch', 'NetworkX', 'RL'],
    desc: 'Research code behind the IEEE SMC submission: optimally rewiring exchange networks to mitigate poverty, outperforming baseline.',
    cta: 'Read the paper',
    href: '#',
  },
  {
    title: 'Department arcade game',
    tags: ['Next.js', 'Pixi.js', 'MySQL'],
    desc: 'Web game for department marketing events, hosted on IIS, played by 2,000+ people.',
    cta: 'Play',
    href: '#',
  },
  {
    title: 'Makerspace queue automator',
    tags: ['Node.js', 'Google API', 'Box API', 'EC2'],
    desc: 'Webhook listener that turns patron submissions into a live queue, removing 90% of manual entries.',
    cta: 'How it works',
    href: '#',
  },
]

export const AWARD_YEARS = [
  { year: '2021', items: [
    ['Malaysian Computing Challenge', 'Gold Award'],
    ['INTI e-workshop Programming Maze Challenge', '1st Prize'],
    ['INTI e-workshop EDA Circuit Design', '3rd Prize'],
  ] },
  { year: '2020', items: [
    ['International Astronomy and Astrophysics Competition', 'Finalist, Bronze'],
    ['CEC Young Engineers 100 Day Makerthon', 'Silver, Best Advertisement'],
    ['English Online Interclass Debate 2020', '2nd Prize'],
  ] },
  { year: '2019', items: [
    ['The First International Youth UAV Science Camp and Competition', '1st Prize'],
    ['IET Faraday Challenge Malaysia', '2nd Prize'],
    ['IET Faraday Challenge Penang', '2nd Prize'],
    ['UBTECH Robotics Competition Smart Factory', '2nd Prize'],
    ['State Award for Excellence in Extra Curricular Activities', 'Gold Award'],
    ['STEAM Science Fair', 'Merit Prize'],
    ["School's Club Performance Award", 'Gold Award'],
    ["School's Club Performance Report", 'Best Slides Design'],
  ] },
  { year: '2017', items: [
    ['MISCC Robotic Workshop and Competition 2017', 'Excellence Award'],
    ['Choral Speaking Competition', 'Excellence Award'],
    ['13th Annual Interclass Performing Arts Competition', 'Silver Award'],
  ] },
  { year: '2016', items: [
    ['The Second ASEAN Student Science Project Competition (ASPC 2016)', '1st Prize'],
    ['ACCCIM STI Competition', '1st Prize'],
    ['Tan Kah Kee Young Inventors 2016', 'Overall Champion'],
    ['12th Annual Interclass Performing Arts Competition', 'Silver Award'],
    ['Annual Hill Climbing Competition', '20th Place'],
  ] },
]

export const WRITING = [
  {
    meta: '2026 · IEEE SMC (submitted)',
    title: 'Network structure and the persistence of economic inequality: Evidence from agent-based exchange models',
    sub: 'Shields, L., Yong, G., Moreno, E., Dawadi, N., Nye, J., & Goodrich, M. A.',
    href: '#',
  },
  {
    meta: '2026 · BYU SRC',
    title: 'Effects of Gratitude: Reciprocity in Networks and the Dynamics of Inequality',
    sub: 'Yong, G. Presentation at the BYU Student Research Conference.',
    href: '#',
  },
]

export const COURSES = [
  'Reinforcement Learning', 'Algorithm Design & Analysis', 'Software Design',
  'Advanced Software Construction', 'Systems Programming', 'Web Programming',
  'Machine Learning', 'Computational Theory', 'Multivariable Calculus',
]

export const LANGUAGES = 'Python, TypeScript, JavaScript, Java, C, C++, SQL, HTML, CSS, Unix · English, Chinese, Malay'
export const TECHNOLOGIES = 'Agentic Tooling, Node.js, React, Next.js, Express, AWS, MySQL, MongoDB, Supabase, REST API, Git, CI/CD, Sklearn, PyTorch, NumPy, Pandas, NetworkX'

// stagger delay for row entrances
export const stagger = (i) => `${0.15 + i * 0.08}s`
