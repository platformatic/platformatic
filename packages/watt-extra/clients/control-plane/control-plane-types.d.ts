export interface FullResponse<T, U extends number> {
  'statusCode': U;
  'headers': object;
  'body': T;
}

export type GetGenerationsRequest = {
  /**
   * Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
   */
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<'createdAt' | 'id' | 'version'>;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.ilike'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.ilike'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.version.eq'?: number;
  'where.version.neq'?: number;
  'where.version.gt'?: number;
  'where.version.gte'?: number;
  'where.version.lt'?: number;
  'where.version.lte'?: number;
  'where.version.like'?: number;
  'where.version.ilike'?: number;
  'where.version.in'?: string;
  'where.version.nin'?: string;
  'where.version.contains'?: string;
  'where.version.contained'?: string;
  'where.version.overlaps'?: string;
  'where.or'?: Array<string>;
  'orderby.createdAt'?: 'asc' | 'desc';
  'orderby.id'?: 'asc' | 'desc';
  'orderby.version'?: 'asc' | 'desc';
}

/**
 * Default Response
 */
export type GetGenerationsResponseOK = Array<{ 'id'?: string | null; 'version'?: number | null; 'createdAt'?: string | null }>
export type GetGenerationsResponses =
  GetGenerationsResponseOK

export type CreateGenerationRequest = {
  'id'?: string;
  'version': number;
  'createdAt'?: string | null;
}

/**
 * A Generation
 */
export type CreateGenerationResponseOK = { 'id'?: string | null; 'version'?: number | null; 'createdAt'?: string | null }
export type CreateGenerationResponses =
  CreateGenerationResponseOK

export type UpdateGenerationsRequest = {
  'fields'?: Array<'createdAt' | 'id' | 'version'>;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.ilike'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.ilike'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.version.eq'?: number;
  'where.version.neq'?: number;
  'where.version.gt'?: number;
  'where.version.gte'?: number;
  'where.version.lt'?: number;
  'where.version.lte'?: number;
  'where.version.like'?: number;
  'where.version.ilike'?: number;
  'where.version.in'?: string;
  'where.version.nin'?: string;
  'where.version.contains'?: string;
  'where.version.contained'?: string;
  'where.version.overlaps'?: string;
  'where.or'?: Array<string>;
  'id'?: string;
  'version': number;
  'createdAt'?: string | null;
}

/**
 * Default Response
 */
export type UpdateGenerationsResponseOK = Array<{ 'id'?: string | null; 'version'?: number | null; 'createdAt'?: string | null }>
export type UpdateGenerationsResponses =
  UpdateGenerationsResponseOK

export type GetGenerationByIdRequest = {
  'fields'?: Array<'createdAt' | 'id' | 'version'>;
  'id': string;
}

/**
 * A Generation
 */
export type GetGenerationByIdResponseOK = { 'id'?: string | null; 'version'?: number | null; 'createdAt'?: string | null }
export type GetGenerationByIdResponses =
  GetGenerationByIdResponseOK

export type UpdateGenerationRequest = {
  'fields'?: Array<'createdAt' | 'id' | 'version'>;
  'id': string;
  'version': number;
  'createdAt'?: string | null;
}

/**
 * A Generation
 */
export type UpdateGenerationResponseOK = { 'id'?: string | null; 'version'?: number | null; 'createdAt'?: string | null }
export type UpdateGenerationResponses =
  UpdateGenerationResponseOK

export type DeleteGenerationsRequest = {
  'fields'?: Array<'createdAt' | 'id' | 'version'>;
  'id': string;
}

/**
 * A Generation
 */
export type DeleteGenerationsResponseOK = { 'id'?: string | null; 'version'?: number | null; 'createdAt'?: string | null }
export type DeleteGenerationsResponses =
  DeleteGenerationsResponseOK

export type GetGraphsForGenerationRequest = {
  'fields'?: Array<'createdAt' | 'generationId' | 'graph' | 'id'>;
  'id': string;
}

/**
 * Default Response
 */
export type GetGraphsForGenerationResponseOK = Array<{ 'id'?: string | null; 'generationId'?: string | null; 'graph'?: object | null; 'createdAt'?: string | null }>
export type GetGraphsForGenerationResponses =
  GetGraphsForGenerationResponseOK

export type GetGenerationsDeploymentsForGenerationRequest = {
  'fields'?: Array<'deploymentId' | 'generationId'>;
  'id': string;
}

/**
 * Default Response
 */
export type GetGenerationsDeploymentsForGenerationResponseOK = Array<{ 'generationId'?: string | null; 'deploymentId'?: string | null }>
export type GetGenerationsDeploymentsForGenerationResponses =
  GetGenerationsDeploymentsForGenerationResponseOK

export type GetGenerationsApplicationsConfigsForGenerationRequest = {
  'fields'?: Array<'configId' | 'generationId'>;
  'id': string;
}

/**
 * Default Response
 */
export type GetGenerationsApplicationsConfigsForGenerationResponseOK = Array<{ 'generationId'?: string | null; 'configId'?: string | null }>
export type GetGenerationsApplicationsConfigsForGenerationResponses =
  GetGenerationsApplicationsConfigsForGenerationResponseOK

export type GetGraphsRequest = {
  /**
   * Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
   */
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<'createdAt' | 'generationId' | 'graph' | 'id'>;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.ilike'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.generationId.eq'?: string;
  'where.generationId.neq'?: string;
  'where.generationId.gt'?: string;
  'where.generationId.gte'?: string;
  'where.generationId.lt'?: string;
  'where.generationId.lte'?: string;
  'where.generationId.like'?: string;
  'where.generationId.ilike'?: string;
  'where.generationId.in'?: string;
  'where.generationId.nin'?: string;
  'where.generationId.contains'?: string;
  'where.generationId.contained'?: string;
  'where.generationId.overlaps'?: string;
  'where.graph.eq'?: string;
  'where.graph.neq'?: string;
  'where.graph.gt'?: string;
  'where.graph.gte'?: string;
  'where.graph.lt'?: string;
  'where.graph.lte'?: string;
  'where.graph.like'?: string;
  'where.graph.ilike'?: string;
  'where.graph.in'?: string;
  'where.graph.nin'?: string;
  'where.graph.contains'?: string;
  'where.graph.contained'?: string;
  'where.graph.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.ilike'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.or'?: Array<string>;
  'orderby.createdAt'?: 'asc' | 'desc';
  'orderby.generationId'?: 'asc' | 'desc';
  'orderby.graph'?: 'asc' | 'desc';
  'orderby.id'?: 'asc' | 'desc';
}

/**
 * Default Response
 */
export type GetGraphsResponseOK = Array<{ 'id'?: string | null; 'generationId'?: string | null; 'graph'?: object | null; 'createdAt'?: string | null }>
export type GetGraphsResponses =
  GetGraphsResponseOK

export type CreateGraphRequest = {
  'id'?: string;
  'generationId': string;
  'graph': object;
  'createdAt'?: string | null;
}

/**
 * A Graph
 */
export type CreateGraphResponseOK = { 'id'?: string | null; 'generationId'?: string | null; 'graph'?: object | null; 'createdAt'?: string | null }
export type CreateGraphResponses =
  CreateGraphResponseOK

export type UpdateGraphsRequest = {
  'fields'?: Array<'createdAt' | 'generationId' | 'graph' | 'id'>;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.ilike'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.generationId.eq'?: string;
  'where.generationId.neq'?: string;
  'where.generationId.gt'?: string;
  'where.generationId.gte'?: string;
  'where.generationId.lt'?: string;
  'where.generationId.lte'?: string;
  'where.generationId.like'?: string;
  'where.generationId.ilike'?: string;
  'where.generationId.in'?: string;
  'where.generationId.nin'?: string;
  'where.generationId.contains'?: string;
  'where.generationId.contained'?: string;
  'where.generationId.overlaps'?: string;
  'where.graph.eq'?: string;
  'where.graph.neq'?: string;
  'where.graph.gt'?: string;
  'where.graph.gte'?: string;
  'where.graph.lt'?: string;
  'where.graph.lte'?: string;
  'where.graph.like'?: string;
  'where.graph.ilike'?: string;
  'where.graph.in'?: string;
  'where.graph.nin'?: string;
  'where.graph.contains'?: string;
  'where.graph.contained'?: string;
  'where.graph.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.ilike'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.or'?: Array<string>;
  'id'?: string;
  'generationId': string;
  'graph': object;
  'createdAt'?: string | null;
}

/**
 * Default Response
 */
export type UpdateGraphsResponseOK = Array<{ 'id'?: string | null; 'generationId'?: string | null; 'graph'?: object | null; 'createdAt'?: string | null }>
export type UpdateGraphsResponses =
  UpdateGraphsResponseOK

export type GetGraphByIdRequest = {
  'fields'?: Array<'createdAt' | 'generationId' | 'graph' | 'id'>;
  'id': string;
}

/**
 * A Graph
 */
export type GetGraphByIdResponseOK = { 'id'?: string | null; 'generationId'?: string | null; 'graph'?: object | null; 'createdAt'?: string | null }
export type GetGraphByIdResponses =
  GetGraphByIdResponseOK

export type UpdateGraphRequest = {
  'fields'?: Array<'createdAt' | 'generationId' | 'graph' | 'id'>;
  'id': string;
  'generationId': string;
  'graph': object;
  'createdAt'?: string | null;
}

/**
 * A Graph
 */
export type UpdateGraphResponseOK = { 'id'?: string | null; 'generationId'?: string | null; 'graph'?: object | null; 'createdAt'?: string | null }
export type UpdateGraphResponses =
  UpdateGraphResponseOK

export type DeleteGraphsRequest = {
  'fields'?: Array<'createdAt' | 'generationId' | 'graph' | 'id'>;
  'id': string;
}

/**
 * A Graph
 */
export type DeleteGraphsResponseOK = { 'id'?: string | null; 'generationId'?: string | null; 'graph'?: object | null; 'createdAt'?: string | null }
export type DeleteGraphsResponses =
  DeleteGraphsResponseOK

export type GetGenerationForGraphRequest = {
  'fields'?: Array<'createdAt' | 'id' | 'version'>;
  'id': string;
}

/**
 * A Generation
 */
export type GetGenerationForGraphResponseOK = { 'id'?: string | null; 'version'?: number | null; 'createdAt'?: string | null }
export type GetGenerationForGraphResponses =
  GetGenerationForGraphResponseOK

export type GetApplicationsRequest = {
  /**
   * Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
   */
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<'createdAt' | 'id' | 'name'>;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.ilike'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.ilike'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.name.eq'?: string;
  'where.name.neq'?: string;
  'where.name.gt'?: string;
  'where.name.gte'?: string;
  'where.name.lt'?: string;
  'where.name.lte'?: string;
  'where.name.like'?: string;
  'where.name.ilike'?: string;
  'where.name.in'?: string;
  'where.name.nin'?: string;
  'where.name.contains'?: string;
  'where.name.contained'?: string;
  'where.name.overlaps'?: string;
  'where.or'?: Array<string>;
  'orderby.createdAt'?: 'asc' | 'desc';
  'orderby.id'?: 'asc' | 'desc';
  'orderby.name'?: 'asc' | 'desc';
}

/**
 * Default Response
 */
export type GetApplicationsResponseOK = Array<{ 'id'?: string | null; 'name'?: string | null; 'createdAt'?: string | null }>
export type GetApplicationsResponses =
  GetApplicationsResponseOK

export type CreateApplicationRequest = {
  'id'?: string;
  'name': string;
  'createdAt'?: string | null;
}

/**
 * A Application
 */
export type CreateApplicationResponseOK = { 'id'?: string | null; 'name'?: string | null; 'createdAt'?: string | null }
export type CreateApplicationResponses =
  CreateApplicationResponseOK

export type UpdateApplicationsRequest = {
  'fields'?: Array<'createdAt' | 'id' | 'name'>;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.ilike'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.ilike'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.name.eq'?: string;
  'where.name.neq'?: string;
  'where.name.gt'?: string;
  'where.name.gte'?: string;
  'where.name.lt'?: string;
  'where.name.lte'?: string;
  'where.name.like'?: string;
  'where.name.ilike'?: string;
  'where.name.in'?: string;
  'where.name.nin'?: string;
  'where.name.contains'?: string;
  'where.name.contained'?: string;
  'where.name.overlaps'?: string;
  'where.or'?: Array<string>;
  'id'?: string;
  'name': string;
  'createdAt'?: string | null;
}

/**
 * Default Response
 */
export type UpdateApplicationsResponseOK = Array<{ 'id'?: string | null; 'name'?: string | null; 'createdAt'?: string | null }>
export type UpdateApplicationsResponses =
  UpdateApplicationsResponseOK

export type GetApplicationByIdRequest = {
  'fields'?: Array<'createdAt' | 'id' | 'name'>;
  'id': string;
}

/**
 * A Application
 */
export type GetApplicationByIdResponseOK = { 'id'?: string | null; 'name'?: string | null; 'createdAt'?: string | null }
export type GetApplicationByIdResponses =
  GetApplicationByIdResponseOK

export type UpdateApplicationRequest = {
  'fields'?: Array<'createdAt' | 'id' | 'name'>;
  'id': string;
  'name': string;
  'createdAt'?: string | null;
}

/**
 * A Application
 */
export type UpdateApplicationResponseOK = { 'id'?: string | null; 'name'?: string | null; 'createdAt'?: string | null }
export type UpdateApplicationResponses =
  UpdateApplicationResponseOK

export type DeleteApplicationsRequest = {
  'fields'?: Array<'createdAt' | 'id' | 'name'>;
  'id': string;
}

/**
 * A Application
 */
export type DeleteApplicationsResponseOK = { 'id'?: string | null; 'name'?: string | null; 'createdAt'?: string | null }
export type DeleteApplicationsResponses =
  DeleteApplicationsResponseOK

export type GetApplicationsConfigsForApplicationRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'id' | 'resources' | 'version'>;
  'id': string;
}

/**
 * Default Response
 */
export type GetApplicationsConfigsForApplicationResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'version'?: number | null; 'resources'?: object | null; 'createdAt'?: string | null }>
export type GetApplicationsConfigsForApplicationResponses =
  GetApplicationsConfigsForApplicationResponseOK

export type GetApplicationStatesForApplicationRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'id' | 'pltVersion' | 'state'>;
  'id': string;
}

/**
 * Default Response
 */
export type GetApplicationStatesForApplicationResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'pltVersion'?: string | null; 'state'?: object | null; 'createdAt'?: string | null }>
export type GetApplicationStatesForApplicationResponses =
  GetApplicationStatesForApplicationResponseOK

export type GetDeploymentsForApplicationRequest = {
  'fields'?: Array<'applicationId' | 'applicationStateId' | 'createdAt' | 'id' | 'imageId' | 'status'>;
  'id': string;
}

/**
 * Default Response
 */
export type GetDeploymentsForApplicationResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'applicationStateId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'imageId'?: string | null; 'createdAt'?: string | null }>
export type GetDeploymentsForApplicationResponses =
  GetDeploymentsForApplicationResponseOK

export type GetDetectedPodsForApplicationRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'deploymentId' | 'id' | 'podId' | 'status'>;
  'id': string;
}

/**
 * Default Response
 */
export type GetDetectedPodsForApplicationResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'deploymentId'?: string | null; 'podId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'createdAt'?: string | null }>
export type GetDetectedPodsForApplicationResponses =
  GetDetectedPodsForApplicationResponseOK

export type GetApplicationsConfigsRequest = {
  /**
   * Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
   */
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<'applicationId' | 'createdAt' | 'id' | 'resources' | 'version'>;
  'where.applicationId.eq'?: string;
  'where.applicationId.neq'?: string;
  'where.applicationId.gt'?: string;
  'where.applicationId.gte'?: string;
  'where.applicationId.lt'?: string;
  'where.applicationId.lte'?: string;
  'where.applicationId.like'?: string;
  'where.applicationId.ilike'?: string;
  'where.applicationId.in'?: string;
  'where.applicationId.nin'?: string;
  'where.applicationId.contains'?: string;
  'where.applicationId.contained'?: string;
  'where.applicationId.overlaps'?: string;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.ilike'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.ilike'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.resources.eq'?: string;
  'where.resources.neq'?: string;
  'where.resources.gt'?: string;
  'where.resources.gte'?: string;
  'where.resources.lt'?: string;
  'where.resources.lte'?: string;
  'where.resources.like'?: string;
  'where.resources.ilike'?: string;
  'where.resources.in'?: string;
  'where.resources.nin'?: string;
  'where.resources.contains'?: string;
  'where.resources.contained'?: string;
  'where.resources.overlaps'?: string;
  'where.version.eq'?: number;
  'where.version.neq'?: number;
  'where.version.gt'?: number;
  'where.version.gte'?: number;
  'where.version.lt'?: number;
  'where.version.lte'?: number;
  'where.version.like'?: number;
  'where.version.ilike'?: number;
  'where.version.in'?: string;
  'where.version.nin'?: string;
  'where.version.contains'?: string;
  'where.version.contained'?: string;
  'where.version.overlaps'?: string;
  'where.or'?: Array<string>;
  'orderby.applicationId'?: 'asc' | 'desc';
  'orderby.createdAt'?: 'asc' | 'desc';
  'orderby.id'?: 'asc' | 'desc';
  'orderby.resources'?: 'asc' | 'desc';
  'orderby.version'?: 'asc' | 'desc';
}

/**
 * Default Response
 */
export type GetApplicationsConfigsResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'version'?: number | null; 'resources'?: object | null; 'createdAt'?: string | null }>
export type GetApplicationsConfigsResponses =
  GetApplicationsConfigsResponseOK

export type CreateApplicationsConfigRequest = {
  'id'?: string;
  'applicationId': string;
  'version': number;
  'resources': object;
  'createdAt'?: string | null;
}

/**
 * A ApplicationsConfig
 */
export type CreateApplicationsConfigResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'version'?: number | null; 'resources'?: object | null; 'createdAt'?: string | null }
export type CreateApplicationsConfigResponses =
  CreateApplicationsConfigResponseOK

export type UpdateApplicationsConfigsRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'id' | 'resources' | 'version'>;
  'where.applicationId.eq'?: string;
  'where.applicationId.neq'?: string;
  'where.applicationId.gt'?: string;
  'where.applicationId.gte'?: string;
  'where.applicationId.lt'?: string;
  'where.applicationId.lte'?: string;
  'where.applicationId.like'?: string;
  'where.applicationId.ilike'?: string;
  'where.applicationId.in'?: string;
  'where.applicationId.nin'?: string;
  'where.applicationId.contains'?: string;
  'where.applicationId.contained'?: string;
  'where.applicationId.overlaps'?: string;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.ilike'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.ilike'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.resources.eq'?: string;
  'where.resources.neq'?: string;
  'where.resources.gt'?: string;
  'where.resources.gte'?: string;
  'where.resources.lt'?: string;
  'where.resources.lte'?: string;
  'where.resources.like'?: string;
  'where.resources.ilike'?: string;
  'where.resources.in'?: string;
  'where.resources.nin'?: string;
  'where.resources.contains'?: string;
  'where.resources.contained'?: string;
  'where.resources.overlaps'?: string;
  'where.version.eq'?: number;
  'where.version.neq'?: number;
  'where.version.gt'?: number;
  'where.version.gte'?: number;
  'where.version.lt'?: number;
  'where.version.lte'?: number;
  'where.version.like'?: number;
  'where.version.ilike'?: number;
  'where.version.in'?: string;
  'where.version.nin'?: string;
  'where.version.contains'?: string;
  'where.version.contained'?: string;
  'where.version.overlaps'?: string;
  'where.or'?: Array<string>;
  'id'?: string;
  'applicationId': string;
  'version': number;
  'resources': object;
  'createdAt'?: string | null;
}

/**
 * Default Response
 */
export type UpdateApplicationsConfigsResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'version'?: number | null; 'resources'?: object | null; 'createdAt'?: string | null }>
export type UpdateApplicationsConfigsResponses =
  UpdateApplicationsConfigsResponseOK

export type GetApplicationsConfigByIdRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'id' | 'resources' | 'version'>;
  'id': string;
}

/**
 * A ApplicationsConfig
 */
export type GetApplicationsConfigByIdResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'version'?: number | null; 'resources'?: object | null; 'createdAt'?: string | null }
export type GetApplicationsConfigByIdResponses =
  GetApplicationsConfigByIdResponseOK

export type UpdateApplicationsConfigRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'id' | 'resources' | 'version'>;
  'id': string;
  'applicationId': string;
  'version': number;
  'resources': object;
  'createdAt'?: string | null;
}

/**
 * A ApplicationsConfig
 */
export type UpdateApplicationsConfigResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'version'?: number | null; 'resources'?: object | null; 'createdAt'?: string | null }
export type UpdateApplicationsConfigResponses =
  UpdateApplicationsConfigResponseOK

export type DeleteApplicationsConfigsRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'id' | 'resources' | 'version'>;
  'id': string;
}

/**
 * A ApplicationsConfig
 */
export type DeleteApplicationsConfigsResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'version'?: number | null; 'resources'?: object | null; 'createdAt'?: string | null }
export type DeleteApplicationsConfigsResponses =
  DeleteApplicationsConfigsResponseOK

export type GetGenerationsApplicationsConfigsForApplicationsConfigRequest = {
  'fields'?: Array<'configId' | 'generationId'>;
  'id': string;
}

/**
 * Default Response
 */
export type GetGenerationsApplicationsConfigsForApplicationsConfigResponseOK = Array<{ 'generationId'?: string | null; 'configId'?: string | null }>
export type GetGenerationsApplicationsConfigsForApplicationsConfigResponses =
  GetGenerationsApplicationsConfigsForApplicationsConfigResponseOK

export type GetApplicationForApplicationsConfigRequest = {
  'fields'?: Array<'createdAt' | 'id' | 'name'>;
  'id': string;
}

/**
 * A Application
 */
export type GetApplicationForApplicationsConfigResponseOK = { 'id'?: string | null; 'name'?: string | null; 'createdAt'?: string | null }
export type GetApplicationForApplicationsConfigResponses =
  GetApplicationForApplicationsConfigResponseOK

export type GetApplicationStatesRequest = {
  /**
   * Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
   */
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<'applicationId' | 'createdAt' | 'id' | 'pltVersion' | 'state'>;
  'where.applicationId.eq'?: string;
  'where.applicationId.neq'?: string;
  'where.applicationId.gt'?: string;
  'where.applicationId.gte'?: string;
  'where.applicationId.lt'?: string;
  'where.applicationId.lte'?: string;
  'where.applicationId.like'?: string;
  'where.applicationId.ilike'?: string;
  'where.applicationId.in'?: string;
  'where.applicationId.nin'?: string;
  'where.applicationId.contains'?: string;
  'where.applicationId.contained'?: string;
  'where.applicationId.overlaps'?: string;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.ilike'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.ilike'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.pltVersion.eq'?: string;
  'where.pltVersion.neq'?: string;
  'where.pltVersion.gt'?: string;
  'where.pltVersion.gte'?: string;
  'where.pltVersion.lt'?: string;
  'where.pltVersion.lte'?: string;
  'where.pltVersion.like'?: string;
  'where.pltVersion.ilike'?: string;
  'where.pltVersion.in'?: string;
  'where.pltVersion.nin'?: string;
  'where.pltVersion.contains'?: string;
  'where.pltVersion.contained'?: string;
  'where.pltVersion.overlaps'?: string;
  'where.state.eq'?: string;
  'where.state.neq'?: string;
  'where.state.gt'?: string;
  'where.state.gte'?: string;
  'where.state.lt'?: string;
  'where.state.lte'?: string;
  'where.state.like'?: string;
  'where.state.ilike'?: string;
  'where.state.in'?: string;
  'where.state.nin'?: string;
  'where.state.contains'?: string;
  'where.state.contained'?: string;
  'where.state.overlaps'?: string;
  'where.or'?: Array<string>;
  'orderby.applicationId'?: 'asc' | 'desc';
  'orderby.createdAt'?: 'asc' | 'desc';
  'orderby.id'?: 'asc' | 'desc';
  'orderby.pltVersion'?: 'asc' | 'desc';
  'orderby.state'?: 'asc' | 'desc';
}

/**
 * Default Response
 */
export type GetApplicationStatesResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'pltVersion'?: string | null; 'state'?: object | null; 'createdAt'?: string | null }>
export type GetApplicationStatesResponses =
  GetApplicationStatesResponseOK

export type CreateApplicationStateRequest = {
  'id'?: string;
  'applicationId': string;
  'pltVersion': string;
  'state': object;
  'createdAt'?: string | null;
}

/**
 * A ApplicationState
 */
export type CreateApplicationStateResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'pltVersion'?: string | null; 'state'?: object | null; 'createdAt'?: string | null }
export type CreateApplicationStateResponses =
  CreateApplicationStateResponseOK

export type UpdateApplicationStatesRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'id' | 'pltVersion' | 'state'>;
  'where.applicationId.eq'?: string;
  'where.applicationId.neq'?: string;
  'where.applicationId.gt'?: string;
  'where.applicationId.gte'?: string;
  'where.applicationId.lt'?: string;
  'where.applicationId.lte'?: string;
  'where.applicationId.like'?: string;
  'where.applicationId.ilike'?: string;
  'where.applicationId.in'?: string;
  'where.applicationId.nin'?: string;
  'where.applicationId.contains'?: string;
  'where.applicationId.contained'?: string;
  'where.applicationId.overlaps'?: string;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.ilike'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.ilike'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.pltVersion.eq'?: string;
  'where.pltVersion.neq'?: string;
  'where.pltVersion.gt'?: string;
  'where.pltVersion.gte'?: string;
  'where.pltVersion.lt'?: string;
  'where.pltVersion.lte'?: string;
  'where.pltVersion.like'?: string;
  'where.pltVersion.ilike'?: string;
  'where.pltVersion.in'?: string;
  'where.pltVersion.nin'?: string;
  'where.pltVersion.contains'?: string;
  'where.pltVersion.contained'?: string;
  'where.pltVersion.overlaps'?: string;
  'where.state.eq'?: string;
  'where.state.neq'?: string;
  'where.state.gt'?: string;
  'where.state.gte'?: string;
  'where.state.lt'?: string;
  'where.state.lte'?: string;
  'where.state.like'?: string;
  'where.state.ilike'?: string;
  'where.state.in'?: string;
  'where.state.nin'?: string;
  'where.state.contains'?: string;
  'where.state.contained'?: string;
  'where.state.overlaps'?: string;
  'where.or'?: Array<string>;
  'id'?: string;
  'applicationId': string;
  'pltVersion': string;
  'state': object;
  'createdAt'?: string | null;
}

/**
 * Default Response
 */
export type UpdateApplicationStatesResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'pltVersion'?: string | null; 'state'?: object | null; 'createdAt'?: string | null }>
export type UpdateApplicationStatesResponses =
  UpdateApplicationStatesResponseOK

export type GetApplicationStateByIdRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'id' | 'pltVersion' | 'state'>;
  'id': string;
}

/**
 * A ApplicationState
 */
export type GetApplicationStateByIdResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'pltVersion'?: string | null; 'state'?: object | null; 'createdAt'?: string | null }
export type GetApplicationStateByIdResponses =
  GetApplicationStateByIdResponseOK

export type UpdateApplicationStateRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'id' | 'pltVersion' | 'state'>;
  'id': string;
  'applicationId': string;
  'pltVersion': string;
  'state': object;
  'createdAt'?: string | null;
}

/**
 * A ApplicationState
 */
export type UpdateApplicationStateResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'pltVersion'?: string | null; 'state'?: object | null; 'createdAt'?: string | null }
export type UpdateApplicationStateResponses =
  UpdateApplicationStateResponseOK

export type DeleteApplicationStatesRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'id' | 'pltVersion' | 'state'>;
  'id': string;
}

/**
 * A ApplicationState
 */
export type DeleteApplicationStatesResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'pltVersion'?: string | null; 'state'?: object | null; 'createdAt'?: string | null }
export type DeleteApplicationStatesResponses =
  DeleteApplicationStatesResponseOK

export type GetDeploymentsForApplicationStateRequest = {
  'fields'?: Array<'applicationId' | 'applicationStateId' | 'createdAt' | 'id' | 'imageId' | 'status'>;
  'id': string;
}

/**
 * Default Response
 */
export type GetDeploymentsForApplicationStateResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'applicationStateId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'imageId'?: string | null; 'createdAt'?: string | null }>
export type GetDeploymentsForApplicationStateResponses =
  GetDeploymentsForApplicationStateResponseOK

export type GetApplicationForApplicationStateRequest = {
  'fields'?: Array<'createdAt' | 'id' | 'name'>;
  'id': string;
}

/**
 * A Application
 */
export type GetApplicationForApplicationStateResponseOK = { 'id'?: string | null; 'name'?: string | null; 'createdAt'?: string | null }
export type GetApplicationForApplicationStateResponses =
  GetApplicationForApplicationStateResponseOK

export type GetDeploymentsRequest = {
  /**
   * Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
   */
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<'applicationId' | 'applicationStateId' | 'createdAt' | 'id' | 'imageId' | 'status'>;
  'where.applicationId.eq'?: string;
  'where.applicationId.neq'?: string;
  'where.applicationId.gt'?: string;
  'where.applicationId.gte'?: string;
  'where.applicationId.lt'?: string;
  'where.applicationId.lte'?: string;
  'where.applicationId.like'?: string;
  'where.applicationId.ilike'?: string;
  'where.applicationId.in'?: string;
  'where.applicationId.nin'?: string;
  'where.applicationId.contains'?: string;
  'where.applicationId.contained'?: string;
  'where.applicationId.overlaps'?: string;
  'where.applicationStateId.eq'?: string;
  'where.applicationStateId.neq'?: string;
  'where.applicationStateId.gt'?: string;
  'where.applicationStateId.gte'?: string;
  'where.applicationStateId.lt'?: string;
  'where.applicationStateId.lte'?: string;
  'where.applicationStateId.like'?: string;
  'where.applicationStateId.ilike'?: string;
  'where.applicationStateId.in'?: string;
  'where.applicationStateId.nin'?: string;
  'where.applicationStateId.contains'?: string;
  'where.applicationStateId.contained'?: string;
  'where.applicationStateId.overlaps'?: string;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.ilike'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.ilike'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.imageId.eq'?: string;
  'where.imageId.neq'?: string;
  'where.imageId.gt'?: string;
  'where.imageId.gte'?: string;
  'where.imageId.lt'?: string;
  'where.imageId.lte'?: string;
  'where.imageId.like'?: string;
  'where.imageId.ilike'?: string;
  'where.imageId.in'?: string;
  'where.imageId.nin'?: string;
  'where.imageId.contains'?: string;
  'where.imageId.contained'?: string;
  'where.imageId.overlaps'?: string;
  'where.status.eq'?: 'failed' | 'started' | 'starting';
  'where.status.neq'?: 'failed' | 'started' | 'starting';
  'where.status.gt'?: 'failed' | 'started' | 'starting';
  'where.status.gte'?: 'failed' | 'started' | 'starting';
  'where.status.lt'?: 'failed' | 'started' | 'starting';
  'where.status.lte'?: 'failed' | 'started' | 'starting';
  'where.status.like'?: 'failed' | 'started' | 'starting';
  'where.status.ilike'?: 'failed' | 'started' | 'starting';
  'where.status.in'?: string;
  'where.status.nin'?: string;
  'where.status.contains'?: string;
  'where.status.contained'?: string;
  'where.status.overlaps'?: string;
  'where.or'?: Array<string>;
  'orderby.applicationId'?: 'asc' | 'desc';
  'orderby.applicationStateId'?: 'asc' | 'desc';
  'orderby.createdAt'?: 'asc' | 'desc';
  'orderby.id'?: 'asc' | 'desc';
  'orderby.imageId'?: 'asc' | 'desc';
  'orderby.status'?: 'asc' | 'desc';
}

/**
 * Default Response
 */
export type GetDeploymentsResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'applicationStateId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'imageId'?: string | null; 'createdAt'?: string | null }>
export type GetDeploymentsResponses =
  GetDeploymentsResponseOK

export type CreateDeploymentRequest = {
  'id'?: string;
  'applicationId': string;
  'applicationStateId'?: string | null;
  'status': 'failed' | 'started' | 'starting';
  'imageId': string;
  'createdAt'?: string | null;
}

/**
 * A Deployment
 */
export type CreateDeploymentResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'applicationStateId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'imageId'?: string | null; 'createdAt'?: string | null }
export type CreateDeploymentResponses =
  CreateDeploymentResponseOK

export type UpdateDeploymentsRequest = {
  'fields'?: Array<'applicationId' | 'applicationStateId' | 'createdAt' | 'id' | 'imageId' | 'status'>;
  'where.applicationId.eq'?: string;
  'where.applicationId.neq'?: string;
  'where.applicationId.gt'?: string;
  'where.applicationId.gte'?: string;
  'where.applicationId.lt'?: string;
  'where.applicationId.lte'?: string;
  'where.applicationId.like'?: string;
  'where.applicationId.ilike'?: string;
  'where.applicationId.in'?: string;
  'where.applicationId.nin'?: string;
  'where.applicationId.contains'?: string;
  'where.applicationId.contained'?: string;
  'where.applicationId.overlaps'?: string;
  'where.applicationStateId.eq'?: string;
  'where.applicationStateId.neq'?: string;
  'where.applicationStateId.gt'?: string;
  'where.applicationStateId.gte'?: string;
  'where.applicationStateId.lt'?: string;
  'where.applicationStateId.lte'?: string;
  'where.applicationStateId.like'?: string;
  'where.applicationStateId.ilike'?: string;
  'where.applicationStateId.in'?: string;
  'where.applicationStateId.nin'?: string;
  'where.applicationStateId.contains'?: string;
  'where.applicationStateId.contained'?: string;
  'where.applicationStateId.overlaps'?: string;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.ilike'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.ilike'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.imageId.eq'?: string;
  'where.imageId.neq'?: string;
  'where.imageId.gt'?: string;
  'where.imageId.gte'?: string;
  'where.imageId.lt'?: string;
  'where.imageId.lte'?: string;
  'where.imageId.like'?: string;
  'where.imageId.ilike'?: string;
  'where.imageId.in'?: string;
  'where.imageId.nin'?: string;
  'where.imageId.contains'?: string;
  'where.imageId.contained'?: string;
  'where.imageId.overlaps'?: string;
  'where.status.eq'?: 'failed' | 'started' | 'starting';
  'where.status.neq'?: 'failed' | 'started' | 'starting';
  'where.status.gt'?: 'failed' | 'started' | 'starting';
  'where.status.gte'?: 'failed' | 'started' | 'starting';
  'where.status.lt'?: 'failed' | 'started' | 'starting';
  'where.status.lte'?: 'failed' | 'started' | 'starting';
  'where.status.like'?: 'failed' | 'started' | 'starting';
  'where.status.ilike'?: 'failed' | 'started' | 'starting';
  'where.status.in'?: string;
  'where.status.nin'?: string;
  'where.status.contains'?: string;
  'where.status.contained'?: string;
  'where.status.overlaps'?: string;
  'where.or'?: Array<string>;
  'id'?: string;
  'applicationId': string;
  'applicationStateId'?: string | null;
  'status': 'failed' | 'started' | 'starting';
  'imageId': string;
  'createdAt'?: string | null;
}

/**
 * Default Response
 */
export type UpdateDeploymentsResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'applicationStateId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'imageId'?: string | null; 'createdAt'?: string | null }>
export type UpdateDeploymentsResponses =
  UpdateDeploymentsResponseOK

export type GetDeploymentByIdRequest = {
  'fields'?: Array<'applicationId' | 'applicationStateId' | 'createdAt' | 'id' | 'imageId' | 'status'>;
  'id': string;
}

/**
 * A Deployment
 */
export type GetDeploymentByIdResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'applicationStateId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'imageId'?: string | null; 'createdAt'?: string | null }
export type GetDeploymentByIdResponses =
  GetDeploymentByIdResponseOK

export type UpdateDeploymentRequest = {
  'fields'?: Array<'applicationId' | 'applicationStateId' | 'createdAt' | 'id' | 'imageId' | 'status'>;
  'id': string;
  'applicationId': string;
  'applicationStateId'?: string | null;
  'status': 'failed' | 'started' | 'starting';
  'imageId': string;
  'createdAt'?: string | null;
}

/**
 * A Deployment
 */
export type UpdateDeploymentResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'applicationStateId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'imageId'?: string | null; 'createdAt'?: string | null }
export type UpdateDeploymentResponses =
  UpdateDeploymentResponseOK

export type DeleteDeploymentsRequest = {
  'fields'?: Array<'applicationId' | 'applicationStateId' | 'createdAt' | 'id' | 'imageId' | 'status'>;
  'id': string;
}

/**
 * A Deployment
 */
export type DeleteDeploymentsResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'applicationStateId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'imageId'?: string | null; 'createdAt'?: string | null }
export type DeleteDeploymentsResponses =
  DeleteDeploymentsResponseOK

export type GetDetectedPodsForDeploymentRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'deploymentId' | 'id' | 'podId' | 'status'>;
  'id': string;
}

/**
 * Default Response
 */
export type GetDetectedPodsForDeploymentResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'deploymentId'?: string | null; 'podId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'createdAt'?: string | null }>
export type GetDetectedPodsForDeploymentResponses =
  GetDetectedPodsForDeploymentResponseOK

export type GetGenerationsDeploymentsForDeploymentRequest = {
  'fields'?: Array<'deploymentId' | 'generationId'>;
  'id': string;
}

/**
 * Default Response
 */
export type GetGenerationsDeploymentsForDeploymentResponseOK = Array<{ 'generationId'?: string | null; 'deploymentId'?: string | null }>
export type GetGenerationsDeploymentsForDeploymentResponses =
  GetGenerationsDeploymentsForDeploymentResponseOK

export type GetApplicationForDeploymentRequest = {
  'fields'?: Array<'createdAt' | 'id' | 'name'>;
  'id': string;
}

/**
 * A Application
 */
export type GetApplicationForDeploymentResponseOK = { 'id'?: string | null; 'name'?: string | null; 'createdAt'?: string | null }
export type GetApplicationForDeploymentResponses =
  GetApplicationForDeploymentResponseOK

export type GetApplicationStateForDeploymentRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'id' | 'pltVersion' | 'state'>;
  'id': string;
}

/**
 * A ApplicationState
 */
export type GetApplicationStateForDeploymentResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'pltVersion'?: string | null; 'state'?: object | null; 'createdAt'?: string | null }
export type GetApplicationStateForDeploymentResponses =
  GetApplicationStateForDeploymentResponseOK

export type GetDetectedPodsRequest = {
  /**
   * Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
   */
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<'applicationId' | 'createdAt' | 'deploymentId' | 'id' | 'podId' | 'status'>;
  'where.applicationId.eq'?: string;
  'where.applicationId.neq'?: string;
  'where.applicationId.gt'?: string;
  'where.applicationId.gte'?: string;
  'where.applicationId.lt'?: string;
  'where.applicationId.lte'?: string;
  'where.applicationId.like'?: string;
  'where.applicationId.ilike'?: string;
  'where.applicationId.in'?: string;
  'where.applicationId.nin'?: string;
  'where.applicationId.contains'?: string;
  'where.applicationId.contained'?: string;
  'where.applicationId.overlaps'?: string;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.ilike'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.deploymentId.eq'?: string;
  'where.deploymentId.neq'?: string;
  'where.deploymentId.gt'?: string;
  'where.deploymentId.gte'?: string;
  'where.deploymentId.lt'?: string;
  'where.deploymentId.lte'?: string;
  'where.deploymentId.like'?: string;
  'where.deploymentId.ilike'?: string;
  'where.deploymentId.in'?: string;
  'where.deploymentId.nin'?: string;
  'where.deploymentId.contains'?: string;
  'where.deploymentId.contained'?: string;
  'where.deploymentId.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.ilike'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.podId.eq'?: string;
  'where.podId.neq'?: string;
  'where.podId.gt'?: string;
  'where.podId.gte'?: string;
  'where.podId.lt'?: string;
  'where.podId.lte'?: string;
  'where.podId.like'?: string;
  'where.podId.ilike'?: string;
  'where.podId.in'?: string;
  'where.podId.nin'?: string;
  'where.podId.contains'?: string;
  'where.podId.contained'?: string;
  'where.podId.overlaps'?: string;
  'where.status.eq'?: 'failed' | 'started' | 'starting';
  'where.status.neq'?: 'failed' | 'started' | 'starting';
  'where.status.gt'?: 'failed' | 'started' | 'starting';
  'where.status.gte'?: 'failed' | 'started' | 'starting';
  'where.status.lt'?: 'failed' | 'started' | 'starting';
  'where.status.lte'?: 'failed' | 'started' | 'starting';
  'where.status.like'?: 'failed' | 'started' | 'starting';
  'where.status.ilike'?: 'failed' | 'started' | 'starting';
  'where.status.in'?: string;
  'where.status.nin'?: string;
  'where.status.contains'?: string;
  'where.status.contained'?: string;
  'where.status.overlaps'?: string;
  'where.or'?: Array<string>;
  'orderby.applicationId'?: 'asc' | 'desc';
  'orderby.createdAt'?: 'asc' | 'desc';
  'orderby.deploymentId'?: 'asc' | 'desc';
  'orderby.id'?: 'asc' | 'desc';
  'orderby.podId'?: 'asc' | 'desc';
  'orderby.status'?: 'asc' | 'desc';
}

/**
 * Default Response
 */
export type GetDetectedPodsResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'deploymentId'?: string | null; 'podId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'createdAt'?: string | null }>
export type GetDetectedPodsResponses =
  GetDetectedPodsResponseOK

export type CreateDetectedPodRequest = {
  'id'?: string;
  'applicationId': string;
  'deploymentId'?: string | null;
  'podId': string;
  'status': 'failed' | 'started' | 'starting';
  'createdAt'?: string | null;
}

/**
 * A DetectedPod
 */
export type CreateDetectedPodResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'deploymentId'?: string | null; 'podId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'createdAt'?: string | null }
export type CreateDetectedPodResponses =
  CreateDetectedPodResponseOK

export type UpdateDetectedPodsRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'deploymentId' | 'id' | 'podId' | 'status'>;
  'where.applicationId.eq'?: string;
  'where.applicationId.neq'?: string;
  'where.applicationId.gt'?: string;
  'where.applicationId.gte'?: string;
  'where.applicationId.lt'?: string;
  'where.applicationId.lte'?: string;
  'where.applicationId.like'?: string;
  'where.applicationId.ilike'?: string;
  'where.applicationId.in'?: string;
  'where.applicationId.nin'?: string;
  'where.applicationId.contains'?: string;
  'where.applicationId.contained'?: string;
  'where.applicationId.overlaps'?: string;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.ilike'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.deploymentId.eq'?: string;
  'where.deploymentId.neq'?: string;
  'where.deploymentId.gt'?: string;
  'where.deploymentId.gte'?: string;
  'where.deploymentId.lt'?: string;
  'where.deploymentId.lte'?: string;
  'where.deploymentId.like'?: string;
  'where.deploymentId.ilike'?: string;
  'where.deploymentId.in'?: string;
  'where.deploymentId.nin'?: string;
  'where.deploymentId.contains'?: string;
  'where.deploymentId.contained'?: string;
  'where.deploymentId.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.ilike'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.podId.eq'?: string;
  'where.podId.neq'?: string;
  'where.podId.gt'?: string;
  'where.podId.gte'?: string;
  'where.podId.lt'?: string;
  'where.podId.lte'?: string;
  'where.podId.like'?: string;
  'where.podId.ilike'?: string;
  'where.podId.in'?: string;
  'where.podId.nin'?: string;
  'where.podId.contains'?: string;
  'where.podId.contained'?: string;
  'where.podId.overlaps'?: string;
  'where.status.eq'?: 'failed' | 'started' | 'starting';
  'where.status.neq'?: 'failed' | 'started' | 'starting';
  'where.status.gt'?: 'failed' | 'started' | 'starting';
  'where.status.gte'?: 'failed' | 'started' | 'starting';
  'where.status.lt'?: 'failed' | 'started' | 'starting';
  'where.status.lte'?: 'failed' | 'started' | 'starting';
  'where.status.like'?: 'failed' | 'started' | 'starting';
  'where.status.ilike'?: 'failed' | 'started' | 'starting';
  'where.status.in'?: string;
  'where.status.nin'?: string;
  'where.status.contains'?: string;
  'where.status.contained'?: string;
  'where.status.overlaps'?: string;
  'where.or'?: Array<string>;
  'id'?: string;
  'applicationId': string;
  'deploymentId'?: string | null;
  'podId': string;
  'status': 'failed' | 'started' | 'starting';
  'createdAt'?: string | null;
}

/**
 * Default Response
 */
export type UpdateDetectedPodsResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'deploymentId'?: string | null; 'podId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'createdAt'?: string | null }>
export type UpdateDetectedPodsResponses =
  UpdateDetectedPodsResponseOK

export type GetDetectedPodByIdRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'deploymentId' | 'id' | 'podId' | 'status'>;
  'id': string;
}

/**
 * A DetectedPod
 */
export type GetDetectedPodByIdResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'deploymentId'?: string | null; 'podId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'createdAt'?: string | null }
export type GetDetectedPodByIdResponses =
  GetDetectedPodByIdResponseOK

export type UpdateDetectedPodRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'deploymentId' | 'id' | 'podId' | 'status'>;
  'id': string;
  'applicationId': string;
  'deploymentId'?: string | null;
  'podId': string;
  'status': 'failed' | 'started' | 'starting';
  'createdAt'?: string | null;
}

/**
 * A DetectedPod
 */
export type UpdateDetectedPodResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'deploymentId'?: string | null; 'podId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'createdAt'?: string | null }
export type UpdateDetectedPodResponses =
  UpdateDetectedPodResponseOK

export type DeleteDetectedPodsRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'deploymentId' | 'id' | 'podId' | 'status'>;
  'id': string;
}

/**
 * A DetectedPod
 */
export type DeleteDetectedPodsResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'deploymentId'?: string | null; 'podId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'createdAt'?: string | null }
export type DeleteDetectedPodsResponses =
  DeleteDetectedPodsResponseOK

export type GetApplicationForDetectedPodRequest = {
  'fields'?: Array<'createdAt' | 'id' | 'name'>;
  'id': string;
}

/**
 * A Application
 */
export type GetApplicationForDetectedPodResponseOK = { 'id'?: string | null; 'name'?: string | null; 'createdAt'?: string | null }
export type GetApplicationForDetectedPodResponses =
  GetApplicationForDetectedPodResponseOK

export type GetDeploymentForDetectedPodRequest = {
  'fields'?: Array<'applicationId' | 'applicationStateId' | 'createdAt' | 'id' | 'imageId' | 'status'>;
  'id': string;
}

/**
 * A Deployment
 */
export type GetDeploymentForDetectedPodResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'applicationStateId'?: string | null; 'status'?: 'failed' | 'started' | 'starting' | null; 'imageId'?: string | null; 'createdAt'?: string | null }
export type GetDeploymentForDetectedPodResponses =
  GetDeploymentForDetectedPodResponseOK

export type GetGenerationsDeploymentsRequest = {
  /**
   * Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
   */
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<'deploymentId' | 'generationId'>;
  'where.deploymentId.eq'?: string;
  'where.deploymentId.neq'?: string;
  'where.deploymentId.gt'?: string;
  'where.deploymentId.gte'?: string;
  'where.deploymentId.lt'?: string;
  'where.deploymentId.lte'?: string;
  'where.deploymentId.like'?: string;
  'where.deploymentId.ilike'?: string;
  'where.deploymentId.in'?: string;
  'where.deploymentId.nin'?: string;
  'where.deploymentId.contains'?: string;
  'where.deploymentId.contained'?: string;
  'where.deploymentId.overlaps'?: string;
  'where.generationId.eq'?: string;
  'where.generationId.neq'?: string;
  'where.generationId.gt'?: string;
  'where.generationId.gte'?: string;
  'where.generationId.lt'?: string;
  'where.generationId.lte'?: string;
  'where.generationId.like'?: string;
  'where.generationId.ilike'?: string;
  'where.generationId.in'?: string;
  'where.generationId.nin'?: string;
  'where.generationId.contains'?: string;
  'where.generationId.contained'?: string;
  'where.generationId.overlaps'?: string;
  'where.or'?: Array<string>;
  'orderby.deploymentId'?: 'asc' | 'desc';
  'orderby.generationId'?: 'asc' | 'desc';
}

/**
 * Default Response
 */
export type GetGenerationsDeploymentsResponseOK = Array<{ 'generationId'?: string | null; 'deploymentId'?: string | null }>
export type GetGenerationsDeploymentsResponses =
  GetGenerationsDeploymentsResponseOK

export type CreateGenerationsDeploymentRequest = {
  'generationId': string;
  'deploymentId': string;
}

/**
 * A GenerationsDeployment
 */
export type CreateGenerationsDeploymentResponseOK = { 'generationId'?: string | null; 'deploymentId'?: string | null }
export type CreateGenerationsDeploymentResponses =
  CreateGenerationsDeploymentResponseOK

export type UpdateGenerationsDeploymentsRequest = {
  'fields'?: Array<'deploymentId' | 'generationId'>;
  'where.deploymentId.eq'?: string;
  'where.deploymentId.neq'?: string;
  'where.deploymentId.gt'?: string;
  'where.deploymentId.gte'?: string;
  'where.deploymentId.lt'?: string;
  'where.deploymentId.lte'?: string;
  'where.deploymentId.like'?: string;
  'where.deploymentId.ilike'?: string;
  'where.deploymentId.in'?: string;
  'where.deploymentId.nin'?: string;
  'where.deploymentId.contains'?: string;
  'where.deploymentId.contained'?: string;
  'where.deploymentId.overlaps'?: string;
  'where.generationId.eq'?: string;
  'where.generationId.neq'?: string;
  'where.generationId.gt'?: string;
  'where.generationId.gte'?: string;
  'where.generationId.lt'?: string;
  'where.generationId.lte'?: string;
  'where.generationId.like'?: string;
  'where.generationId.ilike'?: string;
  'where.generationId.in'?: string;
  'where.generationId.nin'?: string;
  'where.generationId.contains'?: string;
  'where.generationId.contained'?: string;
  'where.generationId.overlaps'?: string;
  'where.or'?: Array<string>;
  'generationId': string;
  'deploymentId': string;
}

/**
 * Default Response
 */
export type UpdateGenerationsDeploymentsResponseOK = Array<{ 'generationId'?: string | null; 'deploymentId'?: string | null }>
export type UpdateGenerationsDeploymentsResponses =
  UpdateGenerationsDeploymentsResponseOK

export type GetGenerationsDeploymentByGenerationIdAndDeploymentIdRequest = {
  'fields'?: Array<'deploymentId' | 'generationId'>;
  'generationId': string;
  'deploymentId': string;
}

/**
 * A GenerationsDeployment
 */
export type GetGenerationsDeploymentByGenerationIdAndDeploymentIdResponseOK = { 'generationId'?: string | null; 'deploymentId'?: string | null }
export type GetGenerationsDeploymentByGenerationIdAndDeploymentIdResponses =
  GetGenerationsDeploymentByGenerationIdAndDeploymentIdResponseOK

export type PostGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdRequest = {
  'fields'?: Array<'deploymentId' | 'generationId'>;
  'generationId': string;
  'deploymentId': string;
}

/**
 * A GenerationsDeployment
 */
export type PostGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdResponseOK = { 'generationId'?: string | null; 'deploymentId'?: string | null }
export type PostGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdResponses =
  PostGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdResponseOK

export type PutGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdRequest = {
  'fields'?: Array<'deploymentId' | 'generationId'>;
  'generationId': string;
  'deploymentId': string;
}

/**
 * A GenerationsDeployment
 */
export type PutGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdResponseOK = { 'generationId'?: string | null; 'deploymentId'?: string | null }
export type PutGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdResponses =
  PutGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdResponseOK

export type DeleteGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdRequest = {
  'fields'?: Array<'deploymentId' | 'generationId'>;
  'generationId': string;
  'deploymentId': string;
}

/**
 * A GenerationsDeployment
 */
export type DeleteGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdResponseOK = { 'generationId'?: string | null; 'deploymentId'?: string | null }
export type DeleteGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdResponses =
  DeleteGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdResponseOK

export type GetGenerationsApplicationsConfigsRequest = {
  /**
   * Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
   */
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<'configId' | 'generationId'>;
  'where.configId.eq'?: string;
  'where.configId.neq'?: string;
  'where.configId.gt'?: string;
  'where.configId.gte'?: string;
  'where.configId.lt'?: string;
  'where.configId.lte'?: string;
  'where.configId.like'?: string;
  'where.configId.ilike'?: string;
  'where.configId.in'?: string;
  'where.configId.nin'?: string;
  'where.configId.contains'?: string;
  'where.configId.contained'?: string;
  'where.configId.overlaps'?: string;
  'where.generationId.eq'?: string;
  'where.generationId.neq'?: string;
  'where.generationId.gt'?: string;
  'where.generationId.gte'?: string;
  'where.generationId.lt'?: string;
  'where.generationId.lte'?: string;
  'where.generationId.like'?: string;
  'where.generationId.ilike'?: string;
  'where.generationId.in'?: string;
  'where.generationId.nin'?: string;
  'where.generationId.contains'?: string;
  'where.generationId.contained'?: string;
  'where.generationId.overlaps'?: string;
  'where.or'?: Array<string>;
  'orderby.configId'?: 'asc' | 'desc';
  'orderby.generationId'?: 'asc' | 'desc';
}

/**
 * Default Response
 */
export type GetGenerationsApplicationsConfigsResponseOK = Array<{ 'generationId'?: string | null; 'configId'?: string | null }>
export type GetGenerationsApplicationsConfigsResponses =
  GetGenerationsApplicationsConfigsResponseOK

export type CreateGenerationsApplicationsConfigRequest = {
  'generationId': string;
  'configId': string;
}

/**
 * A GenerationsApplicationsConfig
 */
export type CreateGenerationsApplicationsConfigResponseOK = { 'generationId'?: string | null; 'configId'?: string | null }
export type CreateGenerationsApplicationsConfigResponses =
  CreateGenerationsApplicationsConfigResponseOK

export type UpdateGenerationsApplicationsConfigsRequest = {
  'fields'?: Array<'configId' | 'generationId'>;
  'where.configId.eq'?: string;
  'where.configId.neq'?: string;
  'where.configId.gt'?: string;
  'where.configId.gte'?: string;
  'where.configId.lt'?: string;
  'where.configId.lte'?: string;
  'where.configId.like'?: string;
  'where.configId.ilike'?: string;
  'where.configId.in'?: string;
  'where.configId.nin'?: string;
  'where.configId.contains'?: string;
  'where.configId.contained'?: string;
  'where.configId.overlaps'?: string;
  'where.generationId.eq'?: string;
  'where.generationId.neq'?: string;
  'where.generationId.gt'?: string;
  'where.generationId.gte'?: string;
  'where.generationId.lt'?: string;
  'where.generationId.lte'?: string;
  'where.generationId.like'?: string;
  'where.generationId.ilike'?: string;
  'where.generationId.in'?: string;
  'where.generationId.nin'?: string;
  'where.generationId.contains'?: string;
  'where.generationId.contained'?: string;
  'where.generationId.overlaps'?: string;
  'where.or'?: Array<string>;
  'generationId': string;
  'configId': string;
}

/**
 * Default Response
 */
export type UpdateGenerationsApplicationsConfigsResponseOK = Array<{ 'generationId'?: string | null; 'configId'?: string | null }>
export type UpdateGenerationsApplicationsConfigsResponses =
  UpdateGenerationsApplicationsConfigsResponseOK

export type GetGenerationsApplicationsConfigByGenerationIdAndConfigIdRequest = {
  'fields'?: Array<'configId' | 'generationId'>;
  'generationId': string;
  'configId': string;
}

/**
 * A GenerationsApplicationsConfig
 */
export type GetGenerationsApplicationsConfigByGenerationIdAndConfigIdResponseOK = { 'generationId'?: string | null; 'configId'?: string | null }
export type GetGenerationsApplicationsConfigByGenerationIdAndConfigIdResponses =
  GetGenerationsApplicationsConfigByGenerationIdAndConfigIdResponseOK

export type PostGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdRequest = {
  'fields'?: Array<'configId' | 'generationId'>;
  'generationId': string;
  'configId': string;
}

/**
 * A GenerationsApplicationsConfig
 */
export type PostGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdResponseOK = { 'generationId'?: string | null; 'configId'?: string | null }
export type PostGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdResponses =
  PostGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdResponseOK

export type PutGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdRequest = {
  'fields'?: Array<'configId' | 'generationId'>;
  'generationId': string;
  'configId': string;
}

/**
 * A GenerationsApplicationsConfig
 */
export type PutGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdResponseOK = { 'generationId'?: string | null; 'configId'?: string | null }
export type PutGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdResponses =
  PutGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdResponseOK

export type DeleteGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdRequest = {
  'fields'?: Array<'configId' | 'generationId'>;
  'generationId': string;
  'configId': string;
}

/**
 * A GenerationsApplicationsConfig
 */
export type DeleteGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdResponseOK = { 'generationId'?: string | null; 'configId'?: string | null }
export type DeleteGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdResponses =
  DeleteGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdResponseOK

export type GetGenerationGraphRequest = {
  'generationId'?: string;
}

/**
 * Default Response
 */
export type GetGenerationGraphResponseOK = { 'applications': Array<{ 'id': string; 'name': string; 'services': Array<object> }>; 'links': Array<{ 'source': { 'applicationId': string | null; 'serviceId': string | null; 'telemetryId': string }; 'target': { 'applicationId': string | null; 'serviceId': string | null; 'telemetryId': string }; 'requestsAmount': string; 'responseTime': string }> }
export type GetGenerationGraphResponses =
  GetGenerationGraphResponseOK

export type InitApplicationInstanceRequest = {
  'podId': string;
  'applicationName': string;
  'imageId': string;
}

/**
 * Default Response
 */
export type InitApplicationInstanceResponseOK = { 'applicationId': string; 'config': { 'version': number; 'resources'?: { 'threads'?: number; 'heap'?: number; 'services'?: Array<{ 'name'?: string; 'heap'?: number; 'threads'?: number }> } }; 'httpCache': { 'clientOpts'?: { 'host': string; 'port': number; 'username': string; 'password': string; 'keyPrefix': string } }; 'iccServices': Record<string, { 'url': string }> }
export type InitApplicationInstanceResponses =
  InitApplicationInstanceResponseOK

export type SaveApplicationInstanceStatusRequest = {
  'id': string;
  'status': string;
}

export type SaveApplicationInstanceStatusResponseOK = unknown
export type SaveApplicationInstanceStatusResponses =
  FullResponse<SaveApplicationInstanceStatusResponseOK, 200>

export type SaveApplicationInstanceStateRequest = {
  'id': string;
  'metadata': { 'platformaticVersion': string };
  'services': Array<object>;
}

/**
 * Default Response
 */
export type SaveApplicationInstanceStateResponseOK = object
export type SaveApplicationInstanceStateResponses =
  SaveApplicationInstanceStateResponseOK

export type SetApplicationResourcesRequest = {
  'id': string;
  'threads': number;
  'heap': number;
  'services': Array<{ 'name'?: string; 'heap'?: number; 'threads'?: number }>;
}

/**
 * Default Response
 */
export type SetApplicationResourcesResponseOK = object
export type SetApplicationResourcesResponses =
  SetApplicationResourcesResponseOK



export interface ControlPlane {
  setBaseUrl(newUrl: string): void;
  setDefaultHeaders(headers: object): void;
  setDefaultFetchParams(fetchParams: RequestInit): void;
  /**
   * Get generations.
   *
   * Fetch generations from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getGenerations(req: GetGenerationsRequest): Promise<GetGenerationsResponses>;
  /**
   * Create generation.
   *
   * Add new generation to the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  createGeneration(req: CreateGenerationRequest): Promise<CreateGenerationResponses>;
  /**
   * Update generations.
   *
   * Update one or more generations in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateGenerations(req: UpdateGenerationsRequest): Promise<UpdateGenerationsResponses>;
  /**
   * Get Generation by id.
   *
   * Fetch Generation using its id from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getGenerationById(req: GetGenerationByIdRequest): Promise<GetGenerationByIdResponses>;
  /**
   * Update generation.
   *
   * Update generation in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateGeneration(req: UpdateGenerationRequest): Promise<UpdateGenerationResponses>;
  /**
   * Delete generations.
   *
   * Delete one or more generations from the Database.
   * @param req - request parameters object
   * @returns the API response body
   */
  deleteGenerations(req: DeleteGenerationsRequest): Promise<DeleteGenerationsResponses>;
  /**
   * Get graphs for generation.
   *
   * Fetch all the graphs for generation from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getGraphsForGeneration(req: GetGraphsForGenerationRequest): Promise<GetGraphsForGenerationResponses>;
  /**
   * Get generationsDeployments for generation.
   *
   * Fetch all the generationsDeployments for generation from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getGenerationsDeploymentsForGeneration(req: GetGenerationsDeploymentsForGenerationRequest): Promise<GetGenerationsDeploymentsForGenerationResponses>;
  /**
   * Get generationsApplicationsConfigs for generation.
   *
   * Fetch all the generationsApplicationsConfigs for generation from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getGenerationsApplicationsConfigsForGeneration(req: GetGenerationsApplicationsConfigsForGenerationRequest): Promise<GetGenerationsApplicationsConfigsForGenerationResponses>;
  /**
   * Get graphs.
   *
   * Fetch graphs from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getGraphs(req: GetGraphsRequest): Promise<GetGraphsResponses>;
  /**
   * Create graph.
   *
   * Add new graph to the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  createGraph(req: CreateGraphRequest): Promise<CreateGraphResponses>;
  /**
   * Update graphs.
   *
   * Update one or more graphs in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateGraphs(req: UpdateGraphsRequest): Promise<UpdateGraphsResponses>;
  /**
   * Get Graph by id.
   *
   * Fetch Graph using its id from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getGraphById(req: GetGraphByIdRequest): Promise<GetGraphByIdResponses>;
  /**
   * Update graph.
   *
   * Update graph in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateGraph(req: UpdateGraphRequest): Promise<UpdateGraphResponses>;
  /**
   * Delete graphs.
   *
   * Delete one or more graphs from the Database.
   * @param req - request parameters object
   * @returns the API response body
   */
  deleteGraphs(req: DeleteGraphsRequest): Promise<DeleteGraphsResponses>;
  /**
   * Get generation for graph.
   *
   * Fetch the generation for graph from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getGenerationForGraph(req: GetGenerationForGraphRequest): Promise<GetGenerationForGraphResponses>;
  /**
   * Get applications.
   *
   * Fetch applications from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getApplications(req: GetApplicationsRequest): Promise<GetApplicationsResponses>;
  /**
   * Create application.
   *
   * Add new application to the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  createApplication(req: CreateApplicationRequest): Promise<CreateApplicationResponses>;
  /**
   * Update applications.
   *
   * Update one or more applications in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateApplications(req: UpdateApplicationsRequest): Promise<UpdateApplicationsResponses>;
  /**
   * Get Application by id.
   *
   * Fetch Application using its id from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getApplicationById(req: GetApplicationByIdRequest): Promise<GetApplicationByIdResponses>;
  /**
   * Update application.
   *
   * Update application in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateApplication(req: UpdateApplicationRequest): Promise<UpdateApplicationResponses>;
  /**
   * Delete applications.
   *
   * Delete one or more applications from the Database.
   * @param req - request parameters object
   * @returns the API response body
   */
  deleteApplications(req: DeleteApplicationsRequest): Promise<DeleteApplicationsResponses>;
  /**
   * Get applicationsConfigs for application.
   *
   * Fetch all the applicationsConfigs for application from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getApplicationsConfigsForApplication(req: GetApplicationsConfigsForApplicationRequest): Promise<GetApplicationsConfigsForApplicationResponses>;
  /**
   * Get applicationStates for application.
   *
   * Fetch all the applicationStates for application from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getApplicationStatesForApplication(req: GetApplicationStatesForApplicationRequest): Promise<GetApplicationStatesForApplicationResponses>;
  /**
   * Get deployments for application.
   *
   * Fetch all the deployments for application from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getDeploymentsForApplication(req: GetDeploymentsForApplicationRequest): Promise<GetDeploymentsForApplicationResponses>;
  /**
   * Get detectedPods for application.
   *
   * Fetch all the detectedPods for application from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getDetectedPodsForApplication(req: GetDetectedPodsForApplicationRequest): Promise<GetDetectedPodsForApplicationResponses>;
  /**
   * Get applicationsConfigs.
   *
   * Fetch applicationsConfigs from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getApplicationsConfigs(req: GetApplicationsConfigsRequest): Promise<GetApplicationsConfigsResponses>;
  /**
   * Create applicationsConfig.
   *
   * Add new applicationsConfig to the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  createApplicationsConfig(req: CreateApplicationsConfigRequest): Promise<CreateApplicationsConfigResponses>;
  /**
   * Update applicationsConfigs.
   *
   * Update one or more applicationsConfigs in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateApplicationsConfigs(req: UpdateApplicationsConfigsRequest): Promise<UpdateApplicationsConfigsResponses>;
  /**
   * Get ApplicationsConfig by id.
   *
   * Fetch ApplicationsConfig using its id from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getApplicationsConfigById(req: GetApplicationsConfigByIdRequest): Promise<GetApplicationsConfigByIdResponses>;
  /**
   * Update applicationsConfig.
   *
   * Update applicationsConfig in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateApplicationsConfig(req: UpdateApplicationsConfigRequest): Promise<UpdateApplicationsConfigResponses>;
  /**
   * Delete applicationsConfigs.
   *
   * Delete one or more applicationsConfigs from the Database.
   * @param req - request parameters object
   * @returns the API response body
   */
  deleteApplicationsConfigs(req: DeleteApplicationsConfigsRequest): Promise<DeleteApplicationsConfigsResponses>;
  /**
   * Get generationsApplicationsConfigs for applicationsConfig.
   *
   * Fetch all the generationsApplicationsConfigs for applicationsConfig from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getGenerationsApplicationsConfigsForApplicationsConfig(req: GetGenerationsApplicationsConfigsForApplicationsConfigRequest): Promise<GetGenerationsApplicationsConfigsForApplicationsConfigResponses>;
  /**
   * Get application for applicationsConfig.
   *
   * Fetch the application for applicationsConfig from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getApplicationForApplicationsConfig(req: GetApplicationForApplicationsConfigRequest): Promise<GetApplicationForApplicationsConfigResponses>;
  /**
   * Get applicationStates.
   *
   * Fetch applicationStates from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getApplicationStates(req: GetApplicationStatesRequest): Promise<GetApplicationStatesResponses>;
  /**
   * Create applicationState.
   *
   * Add new applicationState to the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  createApplicationState(req: CreateApplicationStateRequest): Promise<CreateApplicationStateResponses>;
  /**
   * Update applicationStates.
   *
   * Update one or more applicationStates in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateApplicationStates(req: UpdateApplicationStatesRequest): Promise<UpdateApplicationStatesResponses>;
  /**
   * Get ApplicationState by id.
   *
   * Fetch ApplicationState using its id from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getApplicationStateById(req: GetApplicationStateByIdRequest): Promise<GetApplicationStateByIdResponses>;
  /**
   * Update applicationState.
   *
   * Update applicationState in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateApplicationState(req: UpdateApplicationStateRequest): Promise<UpdateApplicationStateResponses>;
  /**
   * Delete applicationStates.
   *
   * Delete one or more applicationStates from the Database.
   * @param req - request parameters object
   * @returns the API response body
   */
  deleteApplicationStates(req: DeleteApplicationStatesRequest): Promise<DeleteApplicationStatesResponses>;
  /**
   * Get deployments for applicationState.
   *
   * Fetch all the deployments for applicationState from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getDeploymentsForApplicationState(req: GetDeploymentsForApplicationStateRequest): Promise<GetDeploymentsForApplicationStateResponses>;
  /**
   * Get application for applicationState.
   *
   * Fetch the application for applicationState from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getApplicationForApplicationState(req: GetApplicationForApplicationStateRequest): Promise<GetApplicationForApplicationStateResponses>;
  /**
   * Get deployments.
   *
   * Fetch deployments from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getDeployments(req: GetDeploymentsRequest): Promise<GetDeploymentsResponses>;
  /**
   * Create deployment.
   *
   * Add new deployment to the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  createDeployment(req: CreateDeploymentRequest): Promise<CreateDeploymentResponses>;
  /**
   * Update deployments.
   *
   * Update one or more deployments in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateDeployments(req: UpdateDeploymentsRequest): Promise<UpdateDeploymentsResponses>;
  /**
   * Get Deployment by id.
   *
   * Fetch Deployment using its id from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getDeploymentById(req: GetDeploymentByIdRequest): Promise<GetDeploymentByIdResponses>;
  /**
   * Update deployment.
   *
   * Update deployment in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateDeployment(req: UpdateDeploymentRequest): Promise<UpdateDeploymentResponses>;
  /**
   * Delete deployments.
   *
   * Delete one or more deployments from the Database.
   * @param req - request parameters object
   * @returns the API response body
   */
  deleteDeployments(req: DeleteDeploymentsRequest): Promise<DeleteDeploymentsResponses>;
  /**
   * Get detectedPods for deployment.
   *
   * Fetch all the detectedPods for deployment from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getDetectedPodsForDeployment(req: GetDetectedPodsForDeploymentRequest): Promise<GetDetectedPodsForDeploymentResponses>;
  /**
   * Get generationsDeployments for deployment.
   *
   * Fetch all the generationsDeployments for deployment from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getGenerationsDeploymentsForDeployment(req: GetGenerationsDeploymentsForDeploymentRequest): Promise<GetGenerationsDeploymentsForDeploymentResponses>;
  /**
   * Get application for deployment.
   *
   * Fetch the application for deployment from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getApplicationForDeployment(req: GetApplicationForDeploymentRequest): Promise<GetApplicationForDeploymentResponses>;
  /**
   * Get applicationState for deployment.
   *
   * Fetch the applicationState for deployment from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getApplicationStateForDeployment(req: GetApplicationStateForDeploymentRequest): Promise<GetApplicationStateForDeploymentResponses>;
  /**
   * Get detectedPods.
   *
   * Fetch detectedPods from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getDetectedPods(req: GetDetectedPodsRequest): Promise<GetDetectedPodsResponses>;
  /**
   * Create detectedPod.
   *
   * Add new detectedPod to the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  createDetectedPod(req: CreateDetectedPodRequest): Promise<CreateDetectedPodResponses>;
  /**
   * Update detectedPods.
   *
   * Update one or more detectedPods in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateDetectedPods(req: UpdateDetectedPodsRequest): Promise<UpdateDetectedPodsResponses>;
  /**
   * Get DetectedPod by id.
   *
   * Fetch DetectedPod using its id from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getDetectedPodById(req: GetDetectedPodByIdRequest): Promise<GetDetectedPodByIdResponses>;
  /**
   * Update detectedPod.
   *
   * Update detectedPod in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateDetectedPod(req: UpdateDetectedPodRequest): Promise<UpdateDetectedPodResponses>;
  /**
   * Delete detectedPods.
   *
   * Delete one or more detectedPods from the Database.
   * @param req - request parameters object
   * @returns the API response body
   */
  deleteDetectedPods(req: DeleteDetectedPodsRequest): Promise<DeleteDetectedPodsResponses>;
  /**
   * Get application for detectedPod.
   *
   * Fetch the application for detectedPod from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getApplicationForDetectedPod(req: GetApplicationForDetectedPodRequest): Promise<GetApplicationForDetectedPodResponses>;
  /**
   * Get deployment for detectedPod.
   *
   * Fetch the deployment for detectedPod from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getDeploymentForDetectedPod(req: GetDeploymentForDetectedPodRequest): Promise<GetDeploymentForDetectedPodResponses>;
  /**
   * Get generationsDeployments.
   *
   * Fetch generationsDeployments from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getGenerationsDeployments(req: GetGenerationsDeploymentsRequest): Promise<GetGenerationsDeploymentsResponses>;
  /**
   * Create generationsDeployment.
   *
   * Add new generationsDeployment to the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  createGenerationsDeployment(req: CreateGenerationsDeploymentRequest): Promise<CreateGenerationsDeploymentResponses>;
  /**
   * Update generationsDeployments.
   *
   * Update one or more generationsDeployments in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateGenerationsDeployments(req: UpdateGenerationsDeploymentsRequest): Promise<UpdateGenerationsDeploymentsResponses>;
  /**
   * Get GenerationsDeployment by GenerationIdAndDeploymentId.
   *
   * Fetch GenerationsDeployment by GenerationIdAndDeploymentId from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getGenerationsDeploymentByGenerationIdAndDeploymentId(req: GetGenerationsDeploymentByGenerationIdAndDeploymentIdRequest): Promise<GetGenerationsDeploymentByGenerationIdAndDeploymentIdResponses>;
  /**
   * Update GenerationsDeployment by GenerationIdAndDeploymentId.
   *
   * Update GenerationsDeployment by GenerationIdAndDeploymentId in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  postGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentId(req: PostGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdRequest): Promise<PostGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdResponses>;
  /**
   * Update GenerationsDeployment by GenerationIdAndDeploymentId.
   *
   * Update GenerationsDeployment by GenerationIdAndDeploymentId in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  putGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentId(req: PutGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdRequest): Promise<PutGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdResponses>;
  /**
   * Delete GenerationsDeployment by GenerationIdAndDeploymentId.
   *
   * Delete GenerationsDeployment by GenerationIdAndDeploymentId from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  deleteGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentId(req: DeleteGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdRequest): Promise<DeleteGenerationsDeploymentsGenerationGenerationIdDeploymentDeploymentIdResponses>;
  /**
   * Get generationsApplicationsConfigs.
   *
   * Fetch generationsApplicationsConfigs from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getGenerationsApplicationsConfigs(req: GetGenerationsApplicationsConfigsRequest): Promise<GetGenerationsApplicationsConfigsResponses>;
  /**
   * Create generationsApplicationsConfig.
   *
   * Add new generationsApplicationsConfig to the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  createGenerationsApplicationsConfig(req: CreateGenerationsApplicationsConfigRequest): Promise<CreateGenerationsApplicationsConfigResponses>;
  /**
   * Update generationsApplicationsConfigs.
   *
   * Update one or more generationsApplicationsConfigs in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateGenerationsApplicationsConfigs(req: UpdateGenerationsApplicationsConfigsRequest): Promise<UpdateGenerationsApplicationsConfigsResponses>;
  /**
   * Get GenerationsApplicationsConfig by GenerationIdAndConfigId.
   *
   * Fetch GenerationsApplicationsConfig by GenerationIdAndConfigId from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getGenerationsApplicationsConfigByGenerationIdAndConfigId(req: GetGenerationsApplicationsConfigByGenerationIdAndConfigIdRequest): Promise<GetGenerationsApplicationsConfigByGenerationIdAndConfigIdResponses>;
  /**
   * Update GenerationsApplicationsConfig by GenerationIdAndConfigId.
   *
   * Update GenerationsApplicationsConfig by GenerationIdAndConfigId in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  postGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigId(req: PostGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdRequest): Promise<PostGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdResponses>;
  /**
   * Update GenerationsApplicationsConfig by GenerationIdAndConfigId.
   *
   * Update GenerationsApplicationsConfig by GenerationIdAndConfigId in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  putGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigId(req: PutGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdRequest): Promise<PutGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdResponses>;
  /**
   * Delete GenerationsApplicationsConfig by GenerationIdAndConfigId.
   *
   * Delete GenerationsApplicationsConfig by GenerationIdAndConfigId from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  deleteGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigId(req: DeleteGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdRequest): Promise<DeleteGenerationsApplicationsConfigsGenerationGenerationIdApplicationsConfigConfigIdResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  getGenerationGraph(req: GetGenerationGraphRequest): Promise<GetGenerationGraphResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  initApplicationInstance(req: InitApplicationInstanceRequest): Promise<InitApplicationInstanceResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  saveApplicationInstanceStatus(req: SaveApplicationInstanceStatusRequest): Promise<SaveApplicationInstanceStatusResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  saveApplicationInstanceState(req: SaveApplicationInstanceStateRequest): Promise<SaveApplicationInstanceStateResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  setApplicationResources(req: SetApplicationResourcesRequest): Promise<SetApplicationResourcesResponses>;
}
type PlatformaticFrontendClient = Omit<ControlPlane, 'setBaseUrl'>
type BuildOptions = {
  headers?: object
}
export default function build(url: string, options?: BuildOptions): PlatformaticFrontendClient
