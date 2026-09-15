// All site content, verbatim from the resume / design handoff.

export interface Door {
  index: string;
  count: string;
  label: string;
  sub: string;
  href: string;
}

export interface Job {
  when: string;
  title: string;
  org: string;
  points: string[];
}

export interface Project {
  title: string;
  tags: string[];
  desc: string;
}

export interface AwardYear {
  year: string;
  items: [name: string, prize: string][];
}

export interface Writing {
  meta: string;
  title: string;
  sub: string;
}

export interface Photo {
  src: string;
  caption: string;
}

export type LabeledLink = [label: string, href: string];

export const INTRO: [string, string, string] = [
  "Computer Science senior @ Brigham Young University. Graduating ",
  "Dec 2026",
  ", looking for SWE roles and grad school.",
];

export const NAV: LabeledLink[] = [
  ["/", "Home"],
  ["/education", "Education"],
  ["/experience", "Experience"],
  ["/projects", "Projects"],
  ["/awards", "Awards"],
  ["/interests", "Interests"],
];

export const DOORS: Door[] = [
  {
    index: "01",
    count: "5 roles",
    label: "Work",
    sub: "Research at BYU, an AWS event pipeline at Partner.Co, and more.",
    href: "/experience",
  },
  {
    index: "02",
    count: "5 honors",
    label: "Education",
    sub: "Degree in Computer Science, Math minor at Brigham Young University",
    href: "/education",
  },
  {
    index: "03",
    count: "6 items",
    label: "Projects",
    sub: "From a ChatGPT wrapper to investigating network inequality.",
    href: "/projects",
  },
];

export const FOOT_LINKS: LabeledLink[] = [
  ["yonggh@byu.edu", "mailto:yonggh@byu.edu"],
  ["github", "https://github.com/thatlittlechicken"],
  ["linkedin", "https://www.linkedin.com/in/gentyong/"],
  // ['instagram', 'https://instagram.com/genthoong'],
  ["spotify", "https://open.spotify.com/user/22kf3sv5ir57t7v7jf3qm3upy"],
];

export const JOBS: Job[] = [
  {
    when: "Aug 2026 – present / Feb 2025 – Apr 2026",
    title: "Undergraduate Researcher",
    org: "BYU · HCMI Lab & MATRIX Lab",
    points: [
      "Investigated poverty mitigation through RL by optimally rewiring networks using DQN with PyTorch, achieving results outperforming baseline.",
      "Built a consolidated multimodal language repository to reform CRUD operations for NLP training and linguistic research.",
    ],
  },
  {
    when: "Apr 2026 – Aug 2026",
    title: "Software Engineer Intern",
    org: "Partner.Co · Lehi, UT",
    points: [
      "End-to-end event pipeline spanning event definition, database emission, API Gateway, EventBridge, SQS and Lambda, with DynamoDB idempotency handling and DLQs.",
      "Contributed to a Quarkus tracing extension that injects trace context into events, enabling annotation-driven end-to-end CloudWatch tracing.",
    ],
  },
  {
    when: "Jan 2025",
    title: "Co-Founder",
    org: "ZAC Technologies · Petaling Jaya, MY",
    points: [
      "Co-founded a consulting and software company built to make advanced data intelligence practical for business, employing several employees.",
      "Built up early stage services and tools, and led the technical development of the company's software products and services."
    ],
  },
  {
    when: "May 2024 – Dec 2025",
    title: "Web Developer",
    org: "BYU",
    points: [
      "Maintained and improved the department site; created 100+ web pages.",
      "Built a Next.js + Pixi.js game with MySQL user data, hosted on the department IIS server for marketing events, reaching 2,000+ players.",
    ],
  },
  {
    when: "Jan 2024 – Feb 2025",
    title: "Makerspace Lab Technician",
    org: "BYU",
    points: [
      "Backend queue automator integrating Google and Box APIs with Node.js webhooks on EC2, removing 90% of manual entries.",
      "Researched emerging technologies and tools for the university makerspace.",
    ],
  },
  {
    when: "Nov 2022 – Dec 2023",
    title: "HR Information Systems Technician",
    org: "BYU–Hawaii",
    points: [
      "Provided Workday system support for HR department and all 2500+ employees.",
      "Implemented and tested new features, configured 50+ reports in Workday for analysis, developed a time calculator and python data entry scripts.",
    ],
  }
];

export const PROJECTS: Project[] = [
  {
    title: "ChatGPT Wrapper",
    tags: ["TypeScript", "Next.js", "OpenAI API", "AWS", "Tailwind", "SST"],
    desc: "Tailored multimodal agents for real-world needs with various tooling. Serverless via CloudFront + Lambda, Cognito auth, SES email, Aurora and S3 storage.",
  },
  {
    title: "Twitter Clone",
    tags: ["TypeScript", "React", "AWS", "Tailwind", "Jest"], 
    desc: "Serverless twitter clone built with Lambda, SQS, S3, DynamoDB and API Gateway. Object-oriented and test-driven design with high-performance scalability.",
  },
  {
    title: "Outwit Board Game",
    tags: ["Java", "Android"],
    desc: "Recreation of the 1980s two player board game on Android with rudimentary single player AI.",
  },
  {
    title: "Chess",
    tags: ["Java", "Spark", "Maven", "MySQL"],
    desc: "Multiplayer chess game with cross client communication through WebSockets and REST API. Implemented with Spark, Maven and MySQL.",
  }
];

export const AWARD_YEARS: AwardYear[] = [
  {
    year: "2021",
    items: [
      ["Malaysian Computing Challenge", "Gold Award"],
      ["INTI e-workshop Programming Maze Challenge", "1st Prize"],
      ["INTI e-workshop EDA Circuit Design", "3rd Prize"],
    ],
  },
  {
    year: "2020",
    items: [
      [
        "International Astronomy and Astrophysics Competition",
        "Finalist, Bronze",
      ],
      ["CEC Young Engineers 100 Day Makerthon", "Silver, Best Advertisement"],
      ["English Online Interclass Debate 2020", "2nd Prize"],
    ],
  },
  {
    year: "2019",
    items: [
      [
        "The First International Youth UAV Science Camp and Competition",
        "1st Prize",
      ],
      ["IET Faraday Challenge Malaysia", "2nd Prize"],
      ["IET Faraday Challenge Penang", "2nd Prize"],
      ["UBTECH Robotics Competition Smart Factory", "2nd Prize"],
      [
        "State Award for Excellence in Extra Curricular Activities",
        "Gold Award",
      ],
      ["STEAM Science Fair", "Merit Prize"],
      ["Club Performance Award (as acting Vice President)", "Gold Award"],
      ["Club Performance Report (as acting Vice President)", "Best Slides Design"],
    ],
  },
  {
    year: "2017",
    items: [
      ["MISCC Robotic Workshop and Competition 2017", "Excellence Award"],
      ["Choral Speaking Competition", "Excellence Award"],
      ["13th Annual Interclass Performing Arts Competition", "Silver Award"],
    ],
  },
  {
    year: "2016",
    items: [
      [
        "The Second ASEAN Student Science Project Competition (ASPC 2016)",
        "1st Prize",
      ],
      ["ACCCIM STI Competition", "1st Prize"],
      ["Tan Kah Kee Young Inventors 2016", "Overall Champion"],
      ["12th Annual Interclass Performing Arts Competition", "Silver Award"],
      ["Annual Hill Climbing Competition", "20th Place"],
    ],
  },
];

export const WRITING: Writing[] = [
  {
    meta: "2026 · IEEE SMC (submitted)",
    title:
      "Network structure and the persistence of economic inequality: Evidence from agent-based exchange models",
    sub: "Shields, L., Yong, G., Moreno, E., Dawadi, N., Nye, J., & Goodrich, M. A.",
  },
  {
    meta: "2026 · BYU SRC",
    title:
      "Effects of Gratitude: Reciprocity in Networks and the Dynamics of Inequality",
    sub: "Yong, G. Presentation at the BYU Student Research Conference.",
  },
];

export const COURSES = [
  "Reinforcement Learning",
  "Algorithm Design & Analysis",
  "Software Design",
  "Advanced Software Construction",
  "Systems Programming",
  "Web Programming",
  "Machine Learning",
  "Computational Theory",
  "Multivariable Calculus",
];

export const LANGUAGES =
  "Python, TypeScript, JavaScript, Java, C, C++, SQL, HTML, CSS, Unix · English, Chinese, Malay";
export const TECHNOLOGIES =
  "Agentic Tooling, Node.js, React, Next.js, Express, AWS, MySQL, MongoDB, Supabase, REST API, Git, CI/CD, Sklearn, PyTorch, NumPy, Pandas, NetworkX";

// photo stack on /interests — drop images in public/photos/ and list them here
export const INTEREST_PHOTOS: Photo[] = [
  { src: "/photos/hike.jpg", caption: "Love the view after a good hike" },
  { src: "/photos/climb.jpg", caption: "Always exciting and fun to climb" },
  { src: "/photos/snow.jpg", caption: "Snowboarding in the winter, hoping for powder" },
  { src: "/photos/frog.jpg", caption: "Random art when I have time" },
  { src: "/photos/concert.jpg", caption: "Classical concerts, I play the violin" },
];

// personal interests shown as chips on /interests — fill these in
export const INTERESTS: string[] = [];

// stagger delay for row entrances
export const stagger = (i: number): string => `${0.15 + i * 0.08}s`;
