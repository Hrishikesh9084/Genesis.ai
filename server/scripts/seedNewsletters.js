import 'dotenv/config';
import db from '../config/db.js';

const newsletterExamples = [
  {
    title: 'Weekly Update - April 1, 2026',
    subject: 'New AI Features & Performance Improvements',
    articles: [
      {
        title: 'Faster Code Generation Engine',
        description: 'We\'ve optimized our AI model for 40% faster code generation. Your projects will be ready even quicker.',
        category: 'Feature',
        link: 'https://genesis.ai/docs/features/fast-generation',
      },
      {
        title: 'Full-Stack Template Library',
        description: 'New pre-built templates for MERN, Next.js, and Django stacks. Pre-configured with best practices.',
        category: 'Update',
        link: 'https://genesis.ai/templates',
      },
      {
        title: 'GitHub Integration Enhanced',
        description: 'Automatic GitHub repo creation now includes CI/CD pipelines. Deploy straight to production.',
        category: 'Feature',
        link: 'https://genesis.ai/docs/github',
      },
      {
        title: 'API Reference Docs Updated',
        description: 'Complete REST API documentation with interactive examples for all deployment endpoints.',
        category: 'Resource',
        link: 'https://genesis.ai/docs/api',
      },
    ],
  },
  {
    title: 'Weekly Update - March 25, 2026',
    subject: 'AI Improvements & Developer Tools',
    articles: [
      {
        title: 'Multi-Language Support Expanded',
        description: 'Genesis.ai now supports TypeScript, Python, Go, and Rust. Write code in your favorite language.',
        category: 'Feature',
        link: 'https://genesis.ai/languages',
      },
      {
        title: 'Environment Variables Management',
        description: 'Securely manage API keys and env vars across frontend and backend with encryption.',
        category: 'Feature',
        link: 'https://genesis.ai/docs/deployment/env',
      },
      {
        title: 'Real-time Collaboration Beta',
        description: 'Work with teammates in real-time on projects. Comment, review, and iterate together.',
        category: 'Beta',
        link: 'https://genesis.ai/beta/collaboration',
      },
      {
        title: 'Developer Tips: Best Practices',
        description: 'Learn how to use AI-generated code effectively. Common patterns and optimization techniques.',
        category: 'Tip',
        link: 'https://genesis.ai/blog/best-practices',
      },
    ],
  },
  {
    title: 'Weekly Update - March 18, 2026',
    subject: 'Deployment & Performance Upgrades',
    articles: [
      {
        title: 'Vercel Integration Improvements',
        description: 'Direct deployment to Vercel with automatic domain configuration and SSL certificates.',
        category: 'Feature',
        link: 'https://genesis.ai/docs/deploy/vercel',
      },
      {
        title: 'Render Backend Deployment',
        description: 'Deploy Node.js, Python, and Go backends with one click. Auto-scaling and monitoring included.',
        category: 'Feature',
        link: 'https://genesis.ai/docs/deploy/render',
      },
      {
        title: 'Database Schema Generator',
        description: 'Automatically generate PostgreSQL schemas from your API definitions. No manual SQL needed.',
        category: 'Feature',
        link: 'https://genesis.ai/docs/database',
      },
      {
        title: 'Performance Monitor Dashboard',
        description: 'Track your deployed app\'s performance with real-time metrics and insights.',
        category: 'Tool',
        link: 'https://genesis.ai/dashboard/monitor',
      },
    ],
  },
  {
    title: 'Weekly Update - March 11, 2026',
    subject: 'Code Quality & Security Enhancements',
    articles: [
      {
        title: 'Automated Testing Framework',
        description: 'Generate unit tests, integration tests, and e2e tests alongside your code automatically.',
        category: 'Feature',
        link: 'https://genesis.ai/docs/testing',
      },
      {
        title: 'Security Audit Tool',
        description: 'Scan generated code for vulnerabilities. OWASP compliance checks included.',
        category: 'Feature',
        link: 'https://genesis.ai/docs/security',
      },
      {
        title: 'TypeScript Strict Mode',
        description: 'All generated TypeScript now uses strict mode by default for type safety.',
        category: 'Update',
        link: 'https://genesis.ai/docs/typescript',
      },
      {
        title: 'Code Review AI Assistant',
        description: 'Get intelligent code review suggestions. Learn best practices as you build.',
        category: 'Tip',
        link: 'https://genesis.ai/docs/review',
      },
    ],
  },
  {
    title: 'Weekly Update - March 4, 2026',
    subject: 'Mobile Apps & Cross-Platform Support',
    articles: [
      {
        title: 'React Native Support Available',
        description: 'Generate React Native apps with cross-platform compatibility for iOS and Android.',
        category: 'Feature',
        link: 'https://genesis.ai/docs/mobile/react-native',
      },
      {
        title: 'Flutter Template Library',
        description: 'Pre-built Flutter templates for common mobile patterns and UI components.',
        category: 'Feature',
        link: 'https://genesis.ai/docs/mobile/flutter',
      },
      {
        title: 'Progressive Web Apps (PWA)',
        description: 'Generated apps are automatically PWA-ready with offline support and service workers.',
        category: 'Update',
        link: 'https://genesis.ai/docs/pwa',
      },
      {
        title: 'Mobile First Design Patterns',
        description: 'Best practices for mobile-first development. Responsive design built in.',
        category: 'Guide',
        link: 'https://genesis.ai/guides/mobile-first',
      },
    ],
  },
];

async function seedNewsletters() {
  try {
    console.log('🌱 Seeding example newsletters...');

    for (const newsletter of newsletterExamples) {
      // Insert newsletter issue
      const issueResult = await db.query(
        `INSERT INTO newsletter_issues (title, subject, status)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [newsletter.title, newsletter.subject, 'draft']
      );

      const issueId = issueResult.rows[0].id;
      console.log(`✅ Created issue: ${newsletter.title}`);

      // Insert articles
      for (let i = 0; i < newsletter.articles.length; i++) {
        const article = newsletter.articles[i];
        await db.query(
          `INSERT INTO newsletter_articles (issue_id, title, description, category, link, order_index)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [issueId, article.title, article.description, article.category, article.link, i]
        );
      }

      console.log(`   └─ Added ${newsletter.articles.length} articles`);
    }

    console.log('\n✨ Newsletter seeding complete!');
    console.log(`\nCreated ${newsletterExamples.length} example newsletters with ${newsletterExamples.reduce((sum, n) => sum + n.articles.length, 0)} articles`);
    console.log('\nYou can now view these in the Admin Newsletter page at /admin/newsletter');

  } catch (error) {
    console.error('❌ Error seeding newsletters:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

seedNewsletters();
