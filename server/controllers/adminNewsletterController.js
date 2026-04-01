import db from '../config/db.js';
import newsletterService from '../services/newsletterService.js';

export default {
  // Newsletter Issues
  async listIssues(req, res) {
    try {
      const { page = 1, pageSize = 10, status } = req.query;
      const offset = (page - 1) * pageSize;
      
      let query = 'SELECT * FROM newsletter_issues';
      let countQuery = 'SELECT COUNT(*) FROM newsletter_issues';
      const params = [];
      
      if (status) {
        query += ' WHERE status = $1';
        countQuery += ' WHERE status = $1';
        params.push(status);
      }
      
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count, 10);
      
      const paramOffset = params.length + 1;
      const paramPageSize = params.length + 2;
      query += ` ORDER BY created_at DESC LIMIT $${paramPageSize} OFFSET $${paramOffset}`;
      
      const result = await db.query(query, [...params, pageSize, offset]);
      
      res.json({
        issues: result.rows,
        pagination: {
          total,
          page: parseInt(page, 10),
          pageSize: parseInt(pageSize, 10),
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      console.error('Error listing newsletter issues:', error);
      res.status(500).json({ error: 'Failed to list newsletter issues' });
    }
  },

  async getIssue(req, res) {
    try {
      const { id } = req.params;
      
      const issueResult = await db.query(
        'SELECT * FROM newsletter_issues WHERE id = $1',
        [id]
      );
      
      if (issueResult.rows.length === 0) {
        return res.status(404).json({ error: 'Newsletter issue not found' });
      }
      
      const articlesResult = await db.query(
        'SELECT * FROM newsletter_articles WHERE issue_id = $1 ORDER BY order_index ASC',
        [id]
      );
      
      const subscriberCount = await db.query(
        'SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = TRUE'
      );
      
      res.json({
        issue: issueResult.rows[0],
        articles: articlesResult.rows,
        subscriberCount: parseInt(subscriberCount.rows[0].count, 10),
      });
    } catch (error) {
      console.error('Error getting newsletter issue:', error);
      res.status(500).json({ error: 'Failed to get newsletter issue' });
    }
  },

  async createIssue(req, res) {
    try {
      const { title, subject } = req.body;
      
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' });
      }
      
      const result = await db.query(
        'INSERT INTO newsletter_issues (title, subject, status) VALUES ($1, $2, $3) RETURNING *',
        [title.trim(), subject?.trim() || title.trim(), 'draft']
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating newsletter issue:', error);
      res.status(500).json({ error: 'Failed to create newsletter issue' });
    }
  },

  async updateIssue(req, res) {
    try {
      const { id } = req.params;
      const { title, subject, status } = req.body;
      
      const issueResult = await db.query(
        'SELECT * FROM newsletter_issues WHERE id = $1',
        [id]
      );
      
      if (issueResult.rows.length === 0) {
        return res.status(404).json({ error: 'Newsletter issue not found' });
      }
      
      const currentIssue = issueResult.rows[0];
      const updates = [];
      const params = [];
      let paramIndex = 1;
      
      if (title !== undefined && title.trim()) {
        updates.push(`title = $${paramIndex++}`);
        params.push(title.trim());
      }
      
      if (subject !== undefined && subject.trim()) {
        updates.push(`subject = $${paramIndex++}`);
        params.push(subject.trim());
      }
      
      if (status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        params.push(status);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }
      
      updates.push(`updated_at = NOW()`);
      params.push(id);
      
      const result = await db.query(
        `UPDATE newsletter_issues SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
      );
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating newsletter issue:', error);
      res.status(500).json({ error: 'Failed to update newsletter issue' });
    }
  },

  async deleteIssue(req, res) {
    try {
      const { id } = req.params;
      
      const result = await db.query(
        'DELETE FROM newsletter_issues WHERE id = $1 RETURNING id',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Newsletter issue not found' });
      }
      
      res.json({ message: 'Newsletter issue deleted' });
    } catch (error) {
      console.error('Error deleting newsletter issue:', error);
      res.status(500).json({ error: 'Failed to delete newsletter issue' });
    }
  },

  // Newsletter Articles
  async createArticle(req, res) {
    try {
      const { issueId, title, description, content, category, link } = req.body;
      
      if (!issueId || !title || !description) {
        return res.status(400).json({ error: 'Issue ID, title, and description are required' });
      }
      
      // Check if issue exists
      const issueResult = await db.query(
        'SELECT id FROM newsletter_issues WHERE id = $1',
        [issueId]
      );
      
      if (issueResult.rows.length === 0) {
        return res.status(404).json({ error: 'Newsletter issue not found' });
      }
      
      // Get max order index for this issue
      const maxOrderResult = await db.query(
        'SELECT MAX(order_index) as max_order FROM newsletter_articles WHERE issue_id = $1',
        [issueId]
      );
      
      const orderIndex = (maxOrderResult.rows[0]?.max_order ?? -1) + 1;
      
      const result = await db.query(
        `INSERT INTO newsletter_articles (issue_id, title, description, content, category, link, order_index)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [issueId, title.trim(), description.trim(), content?.trim() || null, category?.trim() || null, link?.trim() || null, orderIndex]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating newsletter article:', error);
      res.status(500).json({ error: 'Failed to create newsletter article' });
    }
  },

  async updateArticle(req, res) {
    try {
      const { id } = req.params;
      const { title, description, content, category, link, orderIndex } = req.body;
      
      const articleResult = await db.query(
        'SELECT * FROM newsletter_articles WHERE id = $1',
        [id]
      );
      
      if (articleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Newsletter article not found' });
      }
      
      const updates = [];
      const params = [];
      let paramIndex = 1;
      
      if (title !== undefined && title.trim()) {
        updates.push(`title = $${paramIndex++}`);
        params.push(title.trim());
      }
      
      if (description !== undefined && description.trim()) {
        updates.push(`description = $${paramIndex++}`);
        params.push(description.trim());
      }
      
      if (content !== undefined) {
        updates.push(`content = $${paramIndex++}`);
        params.push(content?.trim() || null);
      }
      
      if (category !== undefined) {
        updates.push(`category = $${paramIndex++}`);
        params.push(category?.trim() || null);
      }
      
      if (link !== undefined) {
        updates.push(`link = $${paramIndex++}`);
        params.push(link?.trim() || null);
      }
      
      if (orderIndex !== undefined) {
        updates.push(`order_index = $${paramIndex++}`);
        params.push(orderIndex);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }
      
      updates.push(`updated_at = NOW()`);
      params.push(id);
      
      const result = await db.query(
        `UPDATE newsletter_articles SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
      );
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating newsletter article:', error);
      res.status(500).json({ error: 'Failed to update newsletter article' });
    }
  },

  async deleteArticle(req, res) {
    try {
      const { id } = req.params;
      
      const result = await db.query(
        'DELETE FROM newsletter_articles WHERE id = $1 RETURNING id',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Newsletter article not found' });
      }
      
      res.json({ message: 'Newsletter article deleted' });
    } catch (error) {
      console.error('Error deleting newsletter article:', error);
      res.status(500).json({ error: 'Failed to delete newsletter article' });
    }
  },

  // Send newsletter
  async sendIssue(req, res) {
    try {
      const { id } = req.params;
      
      const issueResult = await db.query(
        'SELECT * FROM newsletter_issues WHERE id = $1',
        [id]
      );
      
      if (issueResult.rows.length === 0) {
        return res.status(404).json({ error: 'Newsletter issue not found' });
      }
      
      const subscribersResult = await db.query(
        'SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = TRUE'
      );
      const activeSubscriberCount = parseInt(subscribersResult.rows[0].count, 10);

      const result = await newsletterService.sendIssue(id);

      if (result.sent === 0) {
        return res.status(502).json({
          error: 'Newsletter delivery failed. No emails were accepted by the mail server.',
          issueId: id,
          activeSubscriberCount,
          delivery: result,
        });
      }
      
      res.json({
        message: `Newsletter sent to ${result.sent} subscribed users`,
        issueId: id,
        activeSubscriberCount,
        delivery: result,
      });
    } catch (error) {
      console.error('Error initiating newsletter send:', error);
      res.status(500).json({ error: 'Failed to send newsletter' });
    }
  },
};
