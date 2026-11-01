// ============================================================================
// n8n-workflow & n8n-core Authentic Data Structures (v1.118.1)
// Reconstructed from:
// - n8n-workflow/dist/cjs/interfaces.d.ts
// - n8n-workflow/dist/cjs/workflow.d.ts
// - n8n-core/dist/execution-engine/workflow-execute.d.ts
// ============================================================================

export type NodeConnectionType =
  | 'main'
  | 'ai_languageModel'
  | 'ai_memory'
  | 'ai_tool'
  | 'ai_outputParser';

export type IDataObject = Record<string, any>;

export interface IPairedItemData {
  item: number;
  input?: number;
}

export interface INodeExecutionData {
  json: IDataObject;
  pairedItem?: IPairedItemData | IPairedItemData[] | number;
  error?: {
    message: string;
    stack?: string;
  };
}

export interface IConnection {
  node: string;
  type: NodeConnectionType;
  index: number;
}

// Array of outputs (by output port index), each containing an array of target connections
export type NodeInputConnections = Array<IConnection[] | null>;

export type IConnections = {
  [sourceNodeName: string]: {
    [type in NodeConnectionType]?: NodeInputConnections;
  };
};

export type NodeParameterValueType =
  | string
  | number
  | boolean
  | undefined
  | null
  | IDataObject
  | NodeParameterValueType[];

export type INodeParameters = Record<string, NodeParameterValueType>;

export interface INode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: INodeParameters;
  disabled?: boolean;
  notes?: string;
  notesInFlow?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  alwaysOutputData?: boolean;
  executeOnce?: boolean;
  onError?: 'stopWorkflow' | 'continueRegularOutput' | 'continueErrorOutput';
}

export type ExecutionStatus =
  | 'new'
  | 'running'
  | 'success'
  | 'error'
  | 'waiting'
  | 'canceled';

export interface ISourceData {
  previousNode: string;
  previousNodeOutput?: number;
  previousNodeRun?: number;
}

export interface ITaskDataConnections {
  [type: string]: Array<INodeExecutionData[] | null>;
}

export interface ITaskData {
  startTime: number;
  executionIndex: number;
  executionTime: number;
  executionStatus?: ExecutionStatus;
  data?: ITaskDataConnections;
  source: Array<ISourceData | null>;
  error?: {
    message: string;
    description?: string;
    stack?: string;
  };
  hints?: string[];
  metadata?: IDataObject;
}

export interface IRunData {
  [nodeName: string]: ITaskData[];
}

export type IPinData = {
  [nodeName: string]: INodeExecutionData[];
};

export interface IExecuteData {
  node: INode;
  data: ITaskDataConnections;
  source: {
    main: Array<ISourceData | null>;
  } | null;
  runIndex?: number;
  metadata?: IDataObject;
}

export interface IWaitingForExecution {
  [nodeName: string]: {
    [runIndex: number]: ITaskDataConnections;
  };
}

export interface IWaitingForExecutionSource {
  [nodeName: string]: {
    [runIndex: number]: {
      [type: string]: Array<ISourceData | null>;
    };
  };
}

export interface IRunExecutionData {
  startData?: {
    destinationNode?: string;
    originalDestinationNode?: string;
    runNodeFilter?: string[];
  };
  resultData: {
    runData: IRunData;
    pinData?: IPinData;
    lastNodeExecuted?: string;
    error?: {
      message: string;
      nodeName?: string;
      stack?: string;
    };
  };
  executionData?: {
    contextData: IDataObject;
    nodeExecutionStack: IExecuteData[];
    metadata: IDataObject;
    waitingExecution: IWaitingForExecution;
    waitingExecutionSource: IWaitingForExecutionSource;
  };
}

export interface IWorkflowSettings {
  executionOrder?: 'v0' | 'v1';
  timezone?: string;
  saveDataErrorExecution?: 'all' | 'none';
  saveDataSuccessExecution?: 'all' | 'none';
}

export interface IWorkflowData {
  id: string;
  name: string;
  active: boolean;
  nodes: INode[];
  connections: IConnections;
  pinData?: IPinData;
  settings: IWorkflowSettings;
}

export interface INodePortDefinition {
  type: NodeConnectionType;
  displayName?: string;
  required?: boolean;
  maxConnections?: number;
}

export interface INodePropertyOption {
  name: string;
  value: string | number | boolean;
  description?: string;
}

export interface INodePropertyDescription {
  displayName: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'options' | 'json' | 'code';
  default: any;
  placeholder?: string;
  description?: string;
  options?: INodePropertyOption[];
  rows?: number;
}

export type NodeCategory =
  | 'trigger'
  | 'core'
  | 'flow'
  | 'ai'
  | 'ai_subnode'
  | 'annotation';

export type NodeShapeVariant =
  | 'prompt-pill'
  | 'agent-card'
  | 'gateway-capsule'
  | 'skill-hexagon'
  | 'mcp-shield'
  | 'output-card'
  | 'trigger-pill'
  | 'flow-diamond-card'
  | 'circle'
  | 'standard'
  | 'sticky';

export interface INodeTypeDescription {
  name: string;
  displayName: string;
  subtitle?: string;
  description: string;
  category: NodeCategory;
  version: number;
  icon: string;
  color: string;
  badgeLabel?: string;
  shapeVariant?: NodeShapeVariant;
  isInlineCard?: boolean; // Renders title, badge & subtitle inside the card body
  isTrigger?: boolean;
  isConfiguration?: boolean; // Sub-node that connects upwards via diamond ports
  isConfigurable?: boolean; // Wide AI Agent node with bottom diamond ports
  isSticky?: boolean;
  inputs: INodePortDefinition[];
  outputs: INodePortDefinition[];
  properties: INodePropertyDescription[];
}

