import { Router, Request, Response, NextFunction } from 'express';
import { nodeTemplateRepository } from '../../db/repositories/node-template.repository';
import { userIdMiddleware } from '../middleware/user-id.middleware';

const router = Router();
router.use(userIdMiddleware);

// GET /api/node-templates
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, technology, search } = req.query as Record<string, string>;
    const templates = await nodeTemplateRepository.list({ category, technology, search });
    res.json({ success: true, templates });
  } catch (err) { next(err); }
});

// GET /api/node-templates/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tmpl = await nodeTemplateRepository.findById(req.params['id']!);
    if (!tmpl) { res.status(404).json({ error: 'Template not found' }); return; }
    res.json({ success: true, template: tmpl });
  } catch (err) { next(err); }
});

// POST /api/node-templates
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    if (!body.name || !body.configTemplate) {
      res.status(400).json({ error: '"name" and "configTemplate" are required' }); return;
    }
    const createdBy = (res.locals['userId'] as string) ?? 'system';
    const tmpl = await nodeTemplateRepository.create({ ...body, createdBy });
    res.status(201).json({ success: true, template: tmpl });
  } catch (err) { next(err); }
});

// PUT /api/node-templates/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tmpl = await nodeTemplateRepository.update(req.params['id']!, req.body);
    if (!tmpl) { res.status(404).json({ error: 'Template not found' }); return; }
    res.json({ success: true, template: tmpl });
  } catch (err) { next(err); }
});

// DELETE /api/node-templates/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await nodeTemplateRepository.delete(req.params['id']!);
    if (!deleted) { res.status(404).json({ error: 'Template not found' }); return; }
    res.json({ success: true });
  } catch (err) { next(err); }
});

export { router as nodeTemplateRouter };
