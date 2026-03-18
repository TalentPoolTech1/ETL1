import { db } from '../db/connection';
import { LoggerFactory } from '../shared/logging';

const log = LoggerFactory.get('metadata');

export interface TechnologyType {
  techId: string;
  techCode: string;
  displayName: string;
  category: string;
  iconName: string | null;
  techDesc: string | null;
}

export class TechnologyService {
  /**
   * Fetches all supported technologies from the static registry.
   */
  static async getAllTechnologies(): Promise<TechnologyType[]> {
    try {
      const result = await db.query(
        `SELECT
           tech_id AS "techId",
           tech_code AS "techCode",
           display_name AS "displayName",
           category,
           icon_name AS "iconName",
           tech_desc_text AS "techDesc"
         FROM meta.fn_get_technologies()`
      );
      return result.rows as unknown as TechnologyType[];
    } catch (err) {
      log.error('metadata.technologies.fetch_failed', 'Failed to fetch technologies from database', err as Error);
      throw err;
    }
  }

  /**
   * Fetches a single technology by its code.
   */
  static async getTechnologyByCode(code: string): Promise<TechnologyType | null> {
    try {
      const result = await db.query(
        `SELECT
           tech_id AS "techId",
           tech_code AS "techCode",
           display_name AS "displayName",
           category,
           icon_name AS "iconName",
           tech_desc_text AS "techDesc"
         FROM meta.fn_get_technology_by_code($1)`,
        [code]
      );
      return (result.rows[0] as unknown as TechnologyType) || null;
    } catch (err) {
      log.error('metadata.technology.fetch_failed', `Failed to fetch technology with code=${code}`, err as Error);
      throw err;
    }
  }
}
