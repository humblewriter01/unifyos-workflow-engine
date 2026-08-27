import type { NextApiRequest, NextApiResponse } from 'next';
import sharedCallback from '../../apps/[id]/callback';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  req.query = { ...req.query, id: 'notion' };
  return sharedCallback(req, res);
}
