// Starter content, inserted into MongoDB ONCE when the database is empty.
// It is not read at runtime — after the first start, all content lives in MongoDB
// and is managed from the admin dashboard (/admin).
import { DEFAULT_SEO } from '../modules/seo/seo.defaults.js';

export const seedContent = {
  profile: {
    name: 'Dhruv Mangroliya',
    role: 'Software Engineer',
    tagline: 'I build fast, reliable backends and the clean interfaces on top of them.',
    intro:
      'Software Engineer at Esyasoft Holding and IIT Guwahati graduate. I design event-driven systems on AWS, migrate legacy platforms to modern stacks, and ship polished React front-ends — and I take on freelance projects.',
    about: [
      'I’m a full-stack engineer with a backend heart. At Esyasoft I’m part of the team migrating a large legacy .NET business platform to a modern, serverless AWS architecture — designing APIs, data models and event pipelines that handle millions of records.',
      'I like problems where performance, cost and correctness all matter: cutting API latency in half, moving workloads to Lambda to cut cloud spend, or building ingestion pipelines that don’t fall over at 500K files.',
      'Outside my day job I help startups and small businesses build web apps, APIs and dashboards — from the first schema to production deploy.',
    ],
    location: 'Bengaluru, India',
    email: '',
    phone: '',
    availability: { open: true, text: 'Open to freelance projects' },
    socials: { github: '', linkedin: '', twitter: '', leetcode: '', website: '' },
    seo: { ...DEFAULT_SEO },
  },

  stats: [
    { value: '20+', label: 'Production APIs shipped' },
    { value: '10M+', label: 'Records migrated' },
    { value: '~50%', label: 'Latency cut with CQRS' },
    { value: '~40%', label: 'Infra cost saved' },
  ],

  experience: [
    {
      role: 'Software Engineer I',
      company: 'Esyasoft Holding',
      location: 'Bengaluru, India',
      start: 'Sep 2025',
      end: '',
      current: true,
      summary: 'SGN Business Application Migration team — moving a legacy .NET platform to a serverless AWS stack.',
      points: [
        'Built 20+ REST APIs using the CQRS pattern, cutting average response latency by ~50%.',
        'Migrated compute-heavy workloads to AWS Lambda, reducing infrastructure cost by ~40%.',
        'Designed an EventBridge + S3 ingestion pipeline processing 500K+ files reliably.',
        'Used DynamoDB Streams to migrate 10M+ records at ~2× the previous throughput.',
        'Modelled schemas and DynamoDB access patterns for the new platform.',
        'Delivered 10+ React / TypeScript / Redux modules and reverse-engineered legacy .NET business logic.',
      ],
      tech: ['Node.js', 'TypeScript', 'AWS Lambda', 'DynamoDB', 'EventBridge', 'S3', 'React', 'Redux'],
    },
  ],

  projects: [
    {
      title: 'Serverless Migration Pipeline',
      category: 'Backend · AWS',
      summary: 'Event-driven pipeline that ingests, validates and migrates millions of legacy records into DynamoDB.',
      points: ['EventBridge + S3 triggers for 500K+ files', 'DynamoDB Streams fan-out at ~2× throughput', 'Idempotent, retry-safe processing'],
      tech: ['AWS Lambda', 'EventBridge', 'DynamoDB', 'Node.js'],
      featured: true,
      accent: 'violet',
    },
    {
      title: 'CQRS API Platform',
      category: 'Backend',
      summary: 'Read/write-separated API layer for a business platform, halving average response time.',
      points: ['20+ endpoints', 'Separate read models', '~50% lower latency'],
      tech: ['Node.js', 'TypeScript', 'REST'],
      accent: 'orange',
    },
    {
      title: 'Personal Life Dashboard',
      category: 'Full-stack · In progress',
      summary: 'This website — a portfolio plus private trackers for weight, diet and habits that replace my spreadsheets.',
      points: ['React + Node + MongoDB', 'Admin CMS', 'Charts & trends'],
      tech: ['React', 'Express', 'MongoDB'],
      accent: 'cyan',
    },
  ],

  services: [
    { title: 'Backend & APIs', description: 'Scalable REST APIs, auth, data modelling and integrations in Node.js / TypeScript.', icon: 'server' },
    { title: 'Cloud & Serverless', description: 'AWS Lambda, DynamoDB, EventBridge and S3 architectures that stay cheap at scale.', icon: 'cloud' },
    { title: 'Web Apps & Dashboards', description: 'Fast, polished React front-ends, admin panels and internal tools.', icon: 'layout' },
    { title: 'Legacy Modernisation', description: 'Untangling old systems and migrating them to a modern stack without downtime.', icon: 'refresh' },
  ],

  skills: [
    { name: 'Languages', skills: ['TypeScript', 'JavaScript', 'C++', 'Python', 'SQL'] },
    { name: 'Backend', skills: ['Node.js', 'Express', 'REST', 'CQRS', 'Microservices'] },
    { name: 'Cloud & Data', skills: ['AWS Lambda', 'DynamoDB', 'EventBridge', 'S3', 'MongoDB', 'PostgreSQL'] },
    { name: 'Frontend', skills: ['React', 'Redux', 'HTML', 'CSS'] },
  ],

  education: [
    {
      school: 'Indian Institute of Technology Guwahati',
      degree: 'Bachelor of Technology (B.Tech)',
      location: 'Guwahati, India',
      start: '2021',
      end: '2025',
      points: [],
    },
  ],
};
