import express from 'express';
import { SAMPLE_WORKFLOWS } from '../src/engine/sampleWorkflows';
import { NODE_TYPE_DESCRIPTIONS } from '../src/engine/nodeTypes';
import { Workflow } from '../src/engine/workflow';
import { WorkflowExecute } from '../src/engine/workflowExecute';
import { IWorkflowData } from '../src/engine/types';

const app = express();
app.use(express.json({ limit: '5mb' }));

let workflowsStore: IWorkflowData[] = structuredClone(SAMPLE_WORKFLOWS);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    reconstructedFrom: 'n8n@1.118.1',
    reaEvidenceIds: [
      'ev_811f0c8f9a781d302d1b14a4ad5c9e0d6e228265d28510d741c4a3daaaa73586',
      'ev_e0618511c645008688d14f2fdb004db8ca33bb78d59486dc1232eb655cd6e2e1',
    ],
  });
});

app.get('/api/node-types', (_req, res) => {
  res.json(Object.values(NODE_TYPE_DESCRIPTIONS));
});

app.get('/api/workflows', (_req, res) => {
  res.json(workflowsStore);
});

app.post('/api/workflows/execute', async (req, res) => {
  try {
    const { workflowData, destinationNode } = req.body as {
      workflowData: IWorkflowData;
      destinationNode?: string;
    };
    const wf = new Workflow(workflowData);
    const executor = new WorkflowExecute();
    const result = await executor.run(
      wf,
      undefined,
      destinationNode,
      workflowData.pinData,
    );
    res.json({ status: executor.status, result });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err?.message || String(err),
    });
  }
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`[n8n-reconstructed API] Listening on http://localhost:${PORT}`);
});

