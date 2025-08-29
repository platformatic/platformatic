export interface FullResponse<T, U extends number> {
  'statusCode': U;
  'headers': object;
  'body': T;
}

export type GetJobsRequest = {
  /**
   * Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
   */
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<'applicationId' | 'body' | 'callbackUrl' | 'createdAt' | 'deletedAt' | 'headers' | 'id' | 'jobType' | 'lastRunAt' | 'maxRetries' | 'method' | 'name' | 'nextRunAt' | 'paused' | 'protected' | 'schedule' | 'status' | 'updatedAt'>;
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
  'where.body.eq'?: string;
  'where.body.neq'?: string;
  'where.body.gt'?: string;
  'where.body.gte'?: string;
  'where.body.lt'?: string;
  'where.body.lte'?: string;
  'where.body.like'?: string;
  'where.body.ilike'?: string;
  'where.body.in'?: string;
  'where.body.nin'?: string;
  'where.body.contains'?: string;
  'where.body.contained'?: string;
  'where.body.overlaps'?: string;
  'where.callbackUrl.eq'?: string;
  'where.callbackUrl.neq'?: string;
  'where.callbackUrl.gt'?: string;
  'where.callbackUrl.gte'?: string;
  'where.callbackUrl.lt'?: string;
  'where.callbackUrl.lte'?: string;
  'where.callbackUrl.like'?: string;
  'where.callbackUrl.ilike'?: string;
  'where.callbackUrl.in'?: string;
  'where.callbackUrl.nin'?: string;
  'where.callbackUrl.contains'?: string;
  'where.callbackUrl.contained'?: string;
  'where.callbackUrl.overlaps'?: string;
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
  'where.deletedAt.eq'?: string;
  'where.deletedAt.neq'?: string;
  'where.deletedAt.gt'?: string;
  'where.deletedAt.gte'?: string;
  'where.deletedAt.lt'?: string;
  'where.deletedAt.lte'?: string;
  'where.deletedAt.like'?: string;
  'where.deletedAt.ilike'?: string;
  'where.deletedAt.in'?: string;
  'where.deletedAt.nin'?: string;
  'where.deletedAt.contains'?: string;
  'where.deletedAt.contained'?: string;
  'where.deletedAt.overlaps'?: string;
  'where.headers.eq'?: string;
  'where.headers.neq'?: string;
  'where.headers.gt'?: string;
  'where.headers.gte'?: string;
  'where.headers.lt'?: string;
  'where.headers.lte'?: string;
  'where.headers.like'?: string;
  'where.headers.ilike'?: string;
  'where.headers.in'?: string;
  'where.headers.nin'?: string;
  'where.headers.contains'?: string;
  'where.headers.contained'?: string;
  'where.headers.overlaps'?: string;
  'where.id.eq'?: number;
  'where.id.neq'?: number;
  'where.id.gt'?: number;
  'where.id.gte'?: number;
  'where.id.lt'?: number;
  'where.id.lte'?: number;
  'where.id.like'?: number;
  'where.id.ilike'?: number;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.jobType.eq'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.neq'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.gt'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.gte'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.lt'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.lte'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.like'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.ilike'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.in'?: string;
  'where.jobType.nin'?: string;
  'where.jobType.contains'?: string;
  'where.jobType.contained'?: string;
  'where.jobType.overlaps'?: string;
  'where.lastRunAt.eq'?: string;
  'where.lastRunAt.neq'?: string;
  'where.lastRunAt.gt'?: string;
  'where.lastRunAt.gte'?: string;
  'where.lastRunAt.lt'?: string;
  'where.lastRunAt.lte'?: string;
  'where.lastRunAt.like'?: string;
  'where.lastRunAt.ilike'?: string;
  'where.lastRunAt.in'?: string;
  'where.lastRunAt.nin'?: string;
  'where.lastRunAt.contains'?: string;
  'where.lastRunAt.contained'?: string;
  'where.lastRunAt.overlaps'?: string;
  'where.maxRetries.eq'?: number;
  'where.maxRetries.neq'?: number;
  'where.maxRetries.gt'?: number;
  'where.maxRetries.gte'?: number;
  'where.maxRetries.lt'?: number;
  'where.maxRetries.lte'?: number;
  'where.maxRetries.like'?: number;
  'where.maxRetries.ilike'?: number;
  'where.maxRetries.in'?: string;
  'where.maxRetries.nin'?: string;
  'where.maxRetries.contains'?: string;
  'where.maxRetries.contained'?: string;
  'where.maxRetries.overlaps'?: string;
  'where.method.eq'?: string;
  'where.method.neq'?: string;
  'where.method.gt'?: string;
  'where.method.gte'?: string;
  'where.method.lt'?: string;
  'where.method.lte'?: string;
  'where.method.like'?: string;
  'where.method.ilike'?: string;
  'where.method.in'?: string;
  'where.method.nin'?: string;
  'where.method.contains'?: string;
  'where.method.contained'?: string;
  'where.method.overlaps'?: string;
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
  'where.nextRunAt.eq'?: string;
  'where.nextRunAt.neq'?: string;
  'where.nextRunAt.gt'?: string;
  'where.nextRunAt.gte'?: string;
  'where.nextRunAt.lt'?: string;
  'where.nextRunAt.lte'?: string;
  'where.nextRunAt.like'?: string;
  'where.nextRunAt.ilike'?: string;
  'where.nextRunAt.in'?: string;
  'where.nextRunAt.nin'?: string;
  'where.nextRunAt.contains'?: string;
  'where.nextRunAt.contained'?: string;
  'where.nextRunAt.overlaps'?: string;
  'where.paused.eq'?: boolean;
  'where.paused.neq'?: boolean;
  'where.paused.gt'?: boolean;
  'where.paused.gte'?: boolean;
  'where.paused.lt'?: boolean;
  'where.paused.lte'?: boolean;
  'where.paused.like'?: boolean;
  'where.paused.ilike'?: boolean;
  'where.paused.in'?: string;
  'where.paused.nin'?: string;
  'where.paused.contains'?: string;
  'where.paused.contained'?: string;
  'where.paused.overlaps'?: string;
  'where.protected.eq'?: boolean;
  'where.protected.neq'?: boolean;
  'where.protected.gt'?: boolean;
  'where.protected.gte'?: boolean;
  'where.protected.lt'?: boolean;
  'where.protected.lte'?: boolean;
  'where.protected.like'?: boolean;
  'where.protected.ilike'?: boolean;
  'where.protected.in'?: string;
  'where.protected.nin'?: string;
  'where.protected.contains'?: string;
  'where.protected.contained'?: string;
  'where.protected.overlaps'?: string;
  'where.schedule.eq'?: string;
  'where.schedule.neq'?: string;
  'where.schedule.gt'?: string;
  'where.schedule.gte'?: string;
  'where.schedule.lt'?: string;
  'where.schedule.lte'?: string;
  'where.schedule.like'?: string;
  'where.schedule.ilike'?: string;
  'where.schedule.in'?: string;
  'where.schedule.nin'?: string;
  'where.schedule.contains'?: string;
  'where.schedule.contained'?: string;
  'where.schedule.overlaps'?: string;
  'where.status.eq'?: string;
  'where.status.neq'?: string;
  'where.status.gt'?: string;
  'where.status.gte'?: string;
  'where.status.lt'?: string;
  'where.status.lte'?: string;
  'where.status.like'?: string;
  'where.status.ilike'?: string;
  'where.status.in'?: string;
  'where.status.nin'?: string;
  'where.status.contains'?: string;
  'where.status.contained'?: string;
  'where.status.overlaps'?: string;
  'where.updatedAt.eq'?: string;
  'where.updatedAt.neq'?: string;
  'where.updatedAt.gt'?: string;
  'where.updatedAt.gte'?: string;
  'where.updatedAt.lt'?: string;
  'where.updatedAt.lte'?: string;
  'where.updatedAt.like'?: string;
  'where.updatedAt.ilike'?: string;
  'where.updatedAt.in'?: string;
  'where.updatedAt.nin'?: string;
  'where.updatedAt.contains'?: string;
  'where.updatedAt.contained'?: string;
  'where.updatedAt.overlaps'?: string;
  'where.or'?: Array<string>;
  'orderby.applicationId'?: 'asc' | 'desc';
  'orderby.body'?: 'asc' | 'desc';
  'orderby.callbackUrl'?: 'asc' | 'desc';
  'orderby.createdAt'?: 'asc' | 'desc';
  'orderby.deletedAt'?: 'asc' | 'desc';
  'orderby.headers'?: 'asc' | 'desc';
  'orderby.id'?: 'asc' | 'desc';
  'orderby.jobType'?: 'asc' | 'desc';
  'orderby.lastRunAt'?: 'asc' | 'desc';
  'orderby.maxRetries'?: 'asc' | 'desc';
  'orderby.method'?: 'asc' | 'desc';
  'orderby.name'?: 'asc' | 'desc';
  'orderby.nextRunAt'?: 'asc' | 'desc';
  'orderby.paused'?: 'asc' | 'desc';
  'orderby.protected'?: 'asc' | 'desc';
  'orderby.schedule'?: 'asc' | 'desc';
  'orderby.status'?: 'asc' | 'desc';
  'orderby.updatedAt'?: 'asc' | 'desc';
}

/**
 * Default Response
 */
export type GetJobsResponseOK = Array<{ 'id'?: number | null; 'name'?: string | null; 'schedule'?: string | null; 'callbackUrl'?: string | null; 'method'?: string | null; 'body'?: string | null; 'headers'?: object | null; 'maxRetries'?: number | null; 'paused'?: boolean | null; 'protected'?: boolean | null; 'applicationId'?: string | null; 'status'?: string | null; 'createdAt'?: string | null; 'updatedAt'?: string | null; 'deletedAt'?: string | null; 'lastRunAt'?: string | null; 'nextRunAt'?: string | null; 'jobType'?: 'ICC' | 'WATT' | 'USER' | null }>
export type GetJobsResponses =
  GetJobsResponseOK

export type CreateJobRequest = {
  'id'?: number;
  'name': string;
  'schedule'?: string | null;
  'callbackUrl'?: string | null;
  'method': string;
  'body'?: string | null;
  'headers'?: object | null;
  'maxRetries': number;
  'paused': boolean;
  'protected': boolean;
  'applicationId'?: string | null;
  'status'?: string | null;
  'createdAt'?: string | null;
  'updatedAt'?: string | null;
  'deletedAt'?: string | null;
  'lastRunAt'?: string | null;
  'nextRunAt'?: string | null;
  'jobType': 'ICC' | 'WATT' | 'USER';
}

/**
 * A Job
 */
export type CreateJobResponseOK = { 'id'?: number | null; 'name'?: string | null; 'schedule'?: string | null; 'callbackUrl'?: string | null; 'method'?: string | null; 'body'?: string | null; 'headers'?: object | null; 'maxRetries'?: number | null; 'paused'?: boolean | null; 'protected'?: boolean | null; 'applicationId'?: string | null; 'status'?: string | null; 'createdAt'?: string | null; 'updatedAt'?: string | null; 'deletedAt'?: string | null; 'lastRunAt'?: string | null; 'nextRunAt'?: string | null; 'jobType'?: 'ICC' | 'WATT' | 'USER' | null }
export type CreateJobResponses =
  CreateJobResponseOK

export type UpdateJobsRequest = {
  'fields'?: Array<'applicationId' | 'body' | 'callbackUrl' | 'createdAt' | 'deletedAt' | 'headers' | 'id' | 'jobType' | 'lastRunAt' | 'maxRetries' | 'method' | 'name' | 'nextRunAt' | 'paused' | 'protected' | 'schedule' | 'status' | 'updatedAt'>;
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
  'where.body.eq'?: string;
  'where.body.neq'?: string;
  'where.body.gt'?: string;
  'where.body.gte'?: string;
  'where.body.lt'?: string;
  'where.body.lte'?: string;
  'where.body.like'?: string;
  'where.body.ilike'?: string;
  'where.body.in'?: string;
  'where.body.nin'?: string;
  'where.body.contains'?: string;
  'where.body.contained'?: string;
  'where.body.overlaps'?: string;
  'where.callbackUrl.eq'?: string;
  'where.callbackUrl.neq'?: string;
  'where.callbackUrl.gt'?: string;
  'where.callbackUrl.gte'?: string;
  'where.callbackUrl.lt'?: string;
  'where.callbackUrl.lte'?: string;
  'where.callbackUrl.like'?: string;
  'where.callbackUrl.ilike'?: string;
  'where.callbackUrl.in'?: string;
  'where.callbackUrl.nin'?: string;
  'where.callbackUrl.contains'?: string;
  'where.callbackUrl.contained'?: string;
  'where.callbackUrl.overlaps'?: string;
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
  'where.deletedAt.eq'?: string;
  'where.deletedAt.neq'?: string;
  'where.deletedAt.gt'?: string;
  'where.deletedAt.gte'?: string;
  'where.deletedAt.lt'?: string;
  'where.deletedAt.lte'?: string;
  'where.deletedAt.like'?: string;
  'where.deletedAt.ilike'?: string;
  'where.deletedAt.in'?: string;
  'where.deletedAt.nin'?: string;
  'where.deletedAt.contains'?: string;
  'where.deletedAt.contained'?: string;
  'where.deletedAt.overlaps'?: string;
  'where.headers.eq'?: string;
  'where.headers.neq'?: string;
  'where.headers.gt'?: string;
  'where.headers.gte'?: string;
  'where.headers.lt'?: string;
  'where.headers.lte'?: string;
  'where.headers.like'?: string;
  'where.headers.ilike'?: string;
  'where.headers.in'?: string;
  'where.headers.nin'?: string;
  'where.headers.contains'?: string;
  'where.headers.contained'?: string;
  'where.headers.overlaps'?: string;
  'where.id.eq'?: number;
  'where.id.neq'?: number;
  'where.id.gt'?: number;
  'where.id.gte'?: number;
  'where.id.lt'?: number;
  'where.id.lte'?: number;
  'where.id.like'?: number;
  'where.id.ilike'?: number;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.jobType.eq'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.neq'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.gt'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.gte'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.lt'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.lte'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.like'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.ilike'?: 'ICC' | 'WATT' | 'USER';
  'where.jobType.in'?: string;
  'where.jobType.nin'?: string;
  'where.jobType.contains'?: string;
  'where.jobType.contained'?: string;
  'where.jobType.overlaps'?: string;
  'where.lastRunAt.eq'?: string;
  'where.lastRunAt.neq'?: string;
  'where.lastRunAt.gt'?: string;
  'where.lastRunAt.gte'?: string;
  'where.lastRunAt.lt'?: string;
  'where.lastRunAt.lte'?: string;
  'where.lastRunAt.like'?: string;
  'where.lastRunAt.ilike'?: string;
  'where.lastRunAt.in'?: string;
  'where.lastRunAt.nin'?: string;
  'where.lastRunAt.contains'?: string;
  'where.lastRunAt.contained'?: string;
  'where.lastRunAt.overlaps'?: string;
  'where.maxRetries.eq'?: number;
  'where.maxRetries.neq'?: number;
  'where.maxRetries.gt'?: number;
  'where.maxRetries.gte'?: number;
  'where.maxRetries.lt'?: number;
  'where.maxRetries.lte'?: number;
  'where.maxRetries.like'?: number;
  'where.maxRetries.ilike'?: number;
  'where.maxRetries.in'?: string;
  'where.maxRetries.nin'?: string;
  'where.maxRetries.contains'?: string;
  'where.maxRetries.contained'?: string;
  'where.maxRetries.overlaps'?: string;
  'where.method.eq'?: string;
  'where.method.neq'?: string;
  'where.method.gt'?: string;
  'where.method.gte'?: string;
  'where.method.lt'?: string;
  'where.method.lte'?: string;
  'where.method.like'?: string;
  'where.method.ilike'?: string;
  'where.method.in'?: string;
  'where.method.nin'?: string;
  'where.method.contains'?: string;
  'where.method.contained'?: string;
  'where.method.overlaps'?: string;
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
  'where.nextRunAt.eq'?: string;
  'where.nextRunAt.neq'?: string;
  'where.nextRunAt.gt'?: string;
  'where.nextRunAt.gte'?: string;
  'where.nextRunAt.lt'?: string;
  'where.nextRunAt.lte'?: string;
  'where.nextRunAt.like'?: string;
  'where.nextRunAt.ilike'?: string;
  'where.nextRunAt.in'?: string;
  'where.nextRunAt.nin'?: string;
  'where.nextRunAt.contains'?: string;
  'where.nextRunAt.contained'?: string;
  'where.nextRunAt.overlaps'?: string;
  'where.paused.eq'?: boolean;
  'where.paused.neq'?: boolean;
  'where.paused.gt'?: boolean;
  'where.paused.gte'?: boolean;
  'where.paused.lt'?: boolean;
  'where.paused.lte'?: boolean;
  'where.paused.like'?: boolean;
  'where.paused.ilike'?: boolean;
  'where.paused.in'?: string;
  'where.paused.nin'?: string;
  'where.paused.contains'?: string;
  'where.paused.contained'?: string;
  'where.paused.overlaps'?: string;
  'where.protected.eq'?: boolean;
  'where.protected.neq'?: boolean;
  'where.protected.gt'?: boolean;
  'where.protected.gte'?: boolean;
  'where.protected.lt'?: boolean;
  'where.protected.lte'?: boolean;
  'where.protected.like'?: boolean;
  'where.protected.ilike'?: boolean;
  'where.protected.in'?: string;
  'where.protected.nin'?: string;
  'where.protected.contains'?: string;
  'where.protected.contained'?: string;
  'where.protected.overlaps'?: string;
  'where.schedule.eq'?: string;
  'where.schedule.neq'?: string;
  'where.schedule.gt'?: string;
  'where.schedule.gte'?: string;
  'where.schedule.lt'?: string;
  'where.schedule.lte'?: string;
  'where.schedule.like'?: string;
  'where.schedule.ilike'?: string;
  'where.schedule.in'?: string;
  'where.schedule.nin'?: string;
  'where.schedule.contains'?: string;
  'where.schedule.contained'?: string;
  'where.schedule.overlaps'?: string;
  'where.status.eq'?: string;
  'where.status.neq'?: string;
  'where.status.gt'?: string;
  'where.status.gte'?: string;
  'where.status.lt'?: string;
  'where.status.lte'?: string;
  'where.status.like'?: string;
  'where.status.ilike'?: string;
  'where.status.in'?: string;
  'where.status.nin'?: string;
  'where.status.contains'?: string;
  'where.status.contained'?: string;
  'where.status.overlaps'?: string;
  'where.updatedAt.eq'?: string;
  'where.updatedAt.neq'?: string;
  'where.updatedAt.gt'?: string;
  'where.updatedAt.gte'?: string;
  'where.updatedAt.lt'?: string;
  'where.updatedAt.lte'?: string;
  'where.updatedAt.like'?: string;
  'where.updatedAt.ilike'?: string;
  'where.updatedAt.in'?: string;
  'where.updatedAt.nin'?: string;
  'where.updatedAt.contains'?: string;
  'where.updatedAt.contained'?: string;
  'where.updatedAt.overlaps'?: string;
  'where.or'?: Array<string>;
  'id'?: number;
  'name': string;
  'schedule'?: string | null;
  'callbackUrl'?: string | null;
  'method': string;
  'body'?: string | null;
  'headers'?: object | null;
  'maxRetries': number;
  'paused': boolean;
  'protected': boolean;
  'applicationId'?: string | null;
  'status'?: string | null;
  'createdAt'?: string | null;
  'updatedAt'?: string | null;
  'deletedAt'?: string | null;
  'lastRunAt'?: string | null;
  'nextRunAt'?: string | null;
  'jobType': 'ICC' | 'WATT' | 'USER';
}

/**
 * Default Response
 */
export type UpdateJobsResponseOK = Array<{ 'id'?: number | null; 'name'?: string | null; 'schedule'?: string | null; 'callbackUrl'?: string | null; 'method'?: string | null; 'body'?: string | null; 'headers'?: object | null; 'maxRetries'?: number | null; 'paused'?: boolean | null; 'protected'?: boolean | null; 'applicationId'?: string | null; 'status'?: string | null; 'createdAt'?: string | null; 'updatedAt'?: string | null; 'deletedAt'?: string | null; 'lastRunAt'?: string | null; 'nextRunAt'?: string | null; 'jobType'?: 'ICC' | 'WATT' | 'USER' | null }>
export type UpdateJobsResponses =
  UpdateJobsResponseOK

export type GetJobByIdRequest = {
  'fields'?: Array<'applicationId' | 'body' | 'callbackUrl' | 'createdAt' | 'deletedAt' | 'headers' | 'id' | 'jobType' | 'lastRunAt' | 'maxRetries' | 'method' | 'name' | 'nextRunAt' | 'paused' | 'protected' | 'schedule' | 'status' | 'updatedAt'>;
  'id': number;
}

/**
 * A Job
 */
export type GetJobByIdResponseOK = { 'id'?: number | null; 'name'?: string | null; 'schedule'?: string | null; 'callbackUrl'?: string | null; 'method'?: string | null; 'body'?: string | null; 'headers'?: object | null; 'maxRetries'?: number | null; 'paused'?: boolean | null; 'protected'?: boolean | null; 'applicationId'?: string | null; 'status'?: string | null; 'createdAt'?: string | null; 'updatedAt'?: string | null; 'deletedAt'?: string | null; 'lastRunAt'?: string | null; 'nextRunAt'?: string | null; 'jobType'?: 'ICC' | 'WATT' | 'USER' | null }
export type GetJobByIdResponses =
  GetJobByIdResponseOK

export type UpdateJobRequest = {
  'fields'?: Array<'applicationId' | 'body' | 'callbackUrl' | 'createdAt' | 'deletedAt' | 'headers' | 'id' | 'jobType' | 'lastRunAt' | 'maxRetries' | 'method' | 'name' | 'nextRunAt' | 'paused' | 'protected' | 'schedule' | 'status' | 'updatedAt'>;
  'id': number;
  'name': string;
  'schedule'?: string | null;
  'callbackUrl'?: string | null;
  'method': string;
  'body'?: string | null;
  'headers'?: object | null;
  'maxRetries': number;
  'paused': boolean;
  'protected': boolean;
  'applicationId'?: string | null;
  'status'?: string | null;
  'createdAt'?: string | null;
  'updatedAt'?: string | null;
  'deletedAt'?: string | null;
  'lastRunAt'?: string | null;
  'nextRunAt'?: string | null;
  'jobType': 'ICC' | 'WATT' | 'USER';
}

/**
 * A Job
 */
export type UpdateJobResponseOK = { 'id'?: number | null; 'name'?: string | null; 'schedule'?: string | null; 'callbackUrl'?: string | null; 'method'?: string | null; 'body'?: string | null; 'headers'?: object | null; 'maxRetries'?: number | null; 'paused'?: boolean | null; 'protected'?: boolean | null; 'applicationId'?: string | null; 'status'?: string | null; 'createdAt'?: string | null; 'updatedAt'?: string | null; 'deletedAt'?: string | null; 'lastRunAt'?: string | null; 'nextRunAt'?: string | null; 'jobType'?: 'ICC' | 'WATT' | 'USER' | null }
export type UpdateJobResponses =
  UpdateJobResponseOK

export type DeleteJobsRequest = {
  'fields'?: Array<'applicationId' | 'body' | 'callbackUrl' | 'createdAt' | 'deletedAt' | 'headers' | 'id' | 'jobType' | 'lastRunAt' | 'maxRetries' | 'method' | 'name' | 'nextRunAt' | 'paused' | 'protected' | 'schedule' | 'status' | 'updatedAt'>;
  'id': number;
}

/**
 * A Job
 */
export type DeleteJobsResponseOK = { 'id'?: number | null; 'name'?: string | null; 'schedule'?: string | null; 'callbackUrl'?: string | null; 'method'?: string | null; 'body'?: string | null; 'headers'?: object | null; 'maxRetries'?: number | null; 'paused'?: boolean | null; 'protected'?: boolean | null; 'applicationId'?: string | null; 'status'?: string | null; 'createdAt'?: string | null; 'updatedAt'?: string | null; 'deletedAt'?: string | null; 'lastRunAt'?: string | null; 'nextRunAt'?: string | null; 'jobType'?: 'ICC' | 'WATT' | 'USER' | null }
export type DeleteJobsResponses =
  DeleteJobsResponseOK

export type GetMessagesForJobRequest = {
  'fields'?: Array<'body' | 'callbackUrl' | 'createdAt' | 'deletedAt' | 'failed' | 'headers' | 'id' | 'jobId' | 'method' | 'noReschedule' | 'responseBody' | 'responseHeaders' | 'responseStatusCode' | 'retries' | 'sentAt' | 'updatedAt' | 'when'>;
  'id': number;
}

/**
 * Default Response
 */
export type GetMessagesForJobResponseOK = Array<{ 'id'?: number | null; 'jobId'?: number | null; 'when'?: string | null; 'failed'?: boolean | null; 'method'?: string | null; 'body'?: string | null; 'headers'?: object | null; 'sentAt'?: string | null; 'retries'?: number | null; 'responseBody'?: string | null; 'responseStatusCode'?: string | null; 'noReschedule'?: boolean | null; 'createdAt'?: string | null; 'updatedAt'?: string | null; 'deletedAt'?: string | null; 'responseHeaders'?: string | null; 'callbackUrl'?: string | null }>
export type GetMessagesForJobResponses =
  GetMessagesForJobResponseOK

export type GetMessagesRequest = {
  /**
   * Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
   */
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<'body' | 'callbackUrl' | 'createdAt' | 'deletedAt' | 'failed' | 'headers' | 'id' | 'jobId' | 'method' | 'noReschedule' | 'responseBody' | 'responseHeaders' | 'responseStatusCode' | 'retries' | 'sentAt' | 'updatedAt' | 'when'>;
  'where.body.eq'?: string;
  'where.body.neq'?: string;
  'where.body.gt'?: string;
  'where.body.gte'?: string;
  'where.body.lt'?: string;
  'where.body.lte'?: string;
  'where.body.like'?: string;
  'where.body.ilike'?: string;
  'where.body.in'?: string;
  'where.body.nin'?: string;
  'where.body.contains'?: string;
  'where.body.contained'?: string;
  'where.body.overlaps'?: string;
  'where.callbackUrl.eq'?: string;
  'where.callbackUrl.neq'?: string;
  'where.callbackUrl.gt'?: string;
  'where.callbackUrl.gte'?: string;
  'where.callbackUrl.lt'?: string;
  'where.callbackUrl.lte'?: string;
  'where.callbackUrl.like'?: string;
  'where.callbackUrl.ilike'?: string;
  'where.callbackUrl.in'?: string;
  'where.callbackUrl.nin'?: string;
  'where.callbackUrl.contains'?: string;
  'where.callbackUrl.contained'?: string;
  'where.callbackUrl.overlaps'?: string;
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
  'where.deletedAt.eq'?: string;
  'where.deletedAt.neq'?: string;
  'where.deletedAt.gt'?: string;
  'where.deletedAt.gte'?: string;
  'where.deletedAt.lt'?: string;
  'where.deletedAt.lte'?: string;
  'where.deletedAt.like'?: string;
  'where.deletedAt.ilike'?: string;
  'where.deletedAt.in'?: string;
  'where.deletedAt.nin'?: string;
  'where.deletedAt.contains'?: string;
  'where.deletedAt.contained'?: string;
  'where.deletedAt.overlaps'?: string;
  'where.failed.eq'?: boolean;
  'where.failed.neq'?: boolean;
  'where.failed.gt'?: boolean;
  'where.failed.gte'?: boolean;
  'where.failed.lt'?: boolean;
  'where.failed.lte'?: boolean;
  'where.failed.like'?: boolean;
  'where.failed.ilike'?: boolean;
  'where.failed.in'?: string;
  'where.failed.nin'?: string;
  'where.failed.contains'?: string;
  'where.failed.contained'?: string;
  'where.failed.overlaps'?: string;
  'where.headers.eq'?: string;
  'where.headers.neq'?: string;
  'where.headers.gt'?: string;
  'where.headers.gte'?: string;
  'where.headers.lt'?: string;
  'where.headers.lte'?: string;
  'where.headers.like'?: string;
  'where.headers.ilike'?: string;
  'where.headers.in'?: string;
  'where.headers.nin'?: string;
  'where.headers.contains'?: string;
  'where.headers.contained'?: string;
  'where.headers.overlaps'?: string;
  'where.id.eq'?: number;
  'where.id.neq'?: number;
  'where.id.gt'?: number;
  'where.id.gte'?: number;
  'where.id.lt'?: number;
  'where.id.lte'?: number;
  'where.id.like'?: number;
  'where.id.ilike'?: number;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.jobId.eq'?: number;
  'where.jobId.neq'?: number;
  'where.jobId.gt'?: number;
  'where.jobId.gte'?: number;
  'where.jobId.lt'?: number;
  'where.jobId.lte'?: number;
  'where.jobId.like'?: number;
  'where.jobId.ilike'?: number;
  'where.jobId.in'?: string;
  'where.jobId.nin'?: string;
  'where.jobId.contains'?: string;
  'where.jobId.contained'?: string;
  'where.jobId.overlaps'?: string;
  'where.method.eq'?: string;
  'where.method.neq'?: string;
  'where.method.gt'?: string;
  'where.method.gte'?: string;
  'where.method.lt'?: string;
  'where.method.lte'?: string;
  'where.method.like'?: string;
  'where.method.ilike'?: string;
  'where.method.in'?: string;
  'where.method.nin'?: string;
  'where.method.contains'?: string;
  'where.method.contained'?: string;
  'where.method.overlaps'?: string;
  'where.noReschedule.eq'?: boolean;
  'where.noReschedule.neq'?: boolean;
  'where.noReschedule.gt'?: boolean;
  'where.noReschedule.gte'?: boolean;
  'where.noReschedule.lt'?: boolean;
  'where.noReschedule.lte'?: boolean;
  'where.noReschedule.like'?: boolean;
  'where.noReschedule.ilike'?: boolean;
  'where.noReschedule.in'?: string;
  'where.noReschedule.nin'?: string;
  'where.noReschedule.contains'?: string;
  'where.noReschedule.contained'?: string;
  'where.noReschedule.overlaps'?: string;
  'where.responseBody.eq'?: string;
  'where.responseBody.neq'?: string;
  'where.responseBody.gt'?: string;
  'where.responseBody.gte'?: string;
  'where.responseBody.lt'?: string;
  'where.responseBody.lte'?: string;
  'where.responseBody.like'?: string;
  'where.responseBody.ilike'?: string;
  'where.responseBody.in'?: string;
  'where.responseBody.nin'?: string;
  'where.responseBody.contains'?: string;
  'where.responseBody.contained'?: string;
  'where.responseBody.overlaps'?: string;
  'where.responseHeaders.eq'?: string;
  'where.responseHeaders.neq'?: string;
  'where.responseHeaders.gt'?: string;
  'where.responseHeaders.gte'?: string;
  'where.responseHeaders.lt'?: string;
  'where.responseHeaders.lte'?: string;
  'where.responseHeaders.like'?: string;
  'where.responseHeaders.ilike'?: string;
  'where.responseHeaders.in'?: string;
  'where.responseHeaders.nin'?: string;
  'where.responseHeaders.contains'?: string;
  'where.responseHeaders.contained'?: string;
  'where.responseHeaders.overlaps'?: string;
  'where.responseStatusCode.eq'?: string;
  'where.responseStatusCode.neq'?: string;
  'where.responseStatusCode.gt'?: string;
  'where.responseStatusCode.gte'?: string;
  'where.responseStatusCode.lt'?: string;
  'where.responseStatusCode.lte'?: string;
  'where.responseStatusCode.like'?: string;
  'where.responseStatusCode.ilike'?: string;
  'where.responseStatusCode.in'?: string;
  'where.responseStatusCode.nin'?: string;
  'where.responseStatusCode.contains'?: string;
  'where.responseStatusCode.contained'?: string;
  'where.responseStatusCode.overlaps'?: string;
  'where.retries.eq'?: number;
  'where.retries.neq'?: number;
  'where.retries.gt'?: number;
  'where.retries.gte'?: number;
  'where.retries.lt'?: number;
  'where.retries.lte'?: number;
  'where.retries.like'?: number;
  'where.retries.ilike'?: number;
  'where.retries.in'?: string;
  'where.retries.nin'?: string;
  'where.retries.contains'?: string;
  'where.retries.contained'?: string;
  'where.retries.overlaps'?: string;
  'where.sentAt.eq'?: string;
  'where.sentAt.neq'?: string;
  'where.sentAt.gt'?: string;
  'where.sentAt.gte'?: string;
  'where.sentAt.lt'?: string;
  'where.sentAt.lte'?: string;
  'where.sentAt.like'?: string;
  'where.sentAt.ilike'?: string;
  'where.sentAt.in'?: string;
  'where.sentAt.nin'?: string;
  'where.sentAt.contains'?: string;
  'where.sentAt.contained'?: string;
  'where.sentAt.overlaps'?: string;
  'where.updatedAt.eq'?: string;
  'where.updatedAt.neq'?: string;
  'where.updatedAt.gt'?: string;
  'where.updatedAt.gte'?: string;
  'where.updatedAt.lt'?: string;
  'where.updatedAt.lte'?: string;
  'where.updatedAt.like'?: string;
  'where.updatedAt.ilike'?: string;
  'where.updatedAt.in'?: string;
  'where.updatedAt.nin'?: string;
  'where.updatedAt.contains'?: string;
  'where.updatedAt.contained'?: string;
  'where.updatedAt.overlaps'?: string;
  'where.when.eq'?: string;
  'where.when.neq'?: string;
  'where.when.gt'?: string;
  'where.when.gte'?: string;
  'where.when.lt'?: string;
  'where.when.lte'?: string;
  'where.when.like'?: string;
  'where.when.ilike'?: string;
  'where.when.in'?: string;
  'where.when.nin'?: string;
  'where.when.contains'?: string;
  'where.when.contained'?: string;
  'where.when.overlaps'?: string;
  'where.or'?: Array<string>;
  'orderby.body'?: 'asc' | 'desc';
  'orderby.callbackUrl'?: 'asc' | 'desc';
  'orderby.createdAt'?: 'asc' | 'desc';
  'orderby.deletedAt'?: 'asc' | 'desc';
  'orderby.failed'?: 'asc' | 'desc';
  'orderby.headers'?: 'asc' | 'desc';
  'orderby.id'?: 'asc' | 'desc';
  'orderby.jobId'?: 'asc' | 'desc';
  'orderby.method'?: 'asc' | 'desc';
  'orderby.noReschedule'?: 'asc' | 'desc';
  'orderby.responseBody'?: 'asc' | 'desc';
  'orderby.responseHeaders'?: 'asc' | 'desc';
  'orderby.responseStatusCode'?: 'asc' | 'desc';
  'orderby.retries'?: 'asc' | 'desc';
  'orderby.sentAt'?: 'asc' | 'desc';
  'orderby.updatedAt'?: 'asc' | 'desc';
  'orderby.when'?: 'asc' | 'desc';
}

/**
 * Default Response
 */
export type GetMessagesResponseOK = Array<{ 'id'?: number | null; 'jobId'?: number | null; 'when'?: string | null; 'failed'?: boolean | null; 'method'?: string | null; 'body'?: string | null; 'headers'?: object | null; 'sentAt'?: string | null; 'retries'?: number | null; 'responseBody'?: string | null; 'responseStatusCode'?: string | null; 'noReschedule'?: boolean | null; 'createdAt'?: string | null; 'updatedAt'?: string | null; 'deletedAt'?: string | null; 'responseHeaders'?: string | null; 'callbackUrl'?: string | null }>
export type GetMessagesResponses =
  GetMessagesResponseOK

export type CreateMessageRequest = {
  'id'?: number;
  'jobId': number;
  'when'?: string | null;
  'failed'?: boolean | null;
  'method': string;
  'body'?: string | null;
  'headers'?: object | null;
  'sentAt'?: string | null;
  'retries'?: number | null;
  'responseBody'?: string | null;
  'responseStatusCode'?: string | null;
  'noReschedule'?: boolean | null;
  'createdAt'?: string | null;
  'updatedAt'?: string | null;
  'deletedAt'?: string | null;
  'responseHeaders'?: string | null;
  'callbackUrl'?: string | null;
}

/**
 * A Message
 */
export type CreateMessageResponseOK = { 'id'?: number | null; 'jobId'?: number | null; 'when'?: string | null; 'failed'?: boolean | null; 'method'?: string | null; 'body'?: string | null; 'headers'?: object | null; 'sentAt'?: string | null; 'retries'?: number | null; 'responseBody'?: string | null; 'responseStatusCode'?: string | null; 'noReschedule'?: boolean | null; 'createdAt'?: string | null; 'updatedAt'?: string | null; 'deletedAt'?: string | null; 'responseHeaders'?: string | null; 'callbackUrl'?: string | null }
export type CreateMessageResponses =
  CreateMessageResponseOK

export type UpdateMessagesRequest = {
  'fields'?: Array<'body' | 'callbackUrl' | 'createdAt' | 'deletedAt' | 'failed' | 'headers' | 'id' | 'jobId' | 'method' | 'noReschedule' | 'responseBody' | 'responseHeaders' | 'responseStatusCode' | 'retries' | 'sentAt' | 'updatedAt' | 'when'>;
  'where.body.eq'?: string;
  'where.body.neq'?: string;
  'where.body.gt'?: string;
  'where.body.gte'?: string;
  'where.body.lt'?: string;
  'where.body.lte'?: string;
  'where.body.like'?: string;
  'where.body.ilike'?: string;
  'where.body.in'?: string;
  'where.body.nin'?: string;
  'where.body.contains'?: string;
  'where.body.contained'?: string;
  'where.body.overlaps'?: string;
  'where.callbackUrl.eq'?: string;
  'where.callbackUrl.neq'?: string;
  'where.callbackUrl.gt'?: string;
  'where.callbackUrl.gte'?: string;
  'where.callbackUrl.lt'?: string;
  'where.callbackUrl.lte'?: string;
  'where.callbackUrl.like'?: string;
  'where.callbackUrl.ilike'?: string;
  'where.callbackUrl.in'?: string;
  'where.callbackUrl.nin'?: string;
  'where.callbackUrl.contains'?: string;
  'where.callbackUrl.contained'?: string;
  'where.callbackUrl.overlaps'?: string;
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
  'where.deletedAt.eq'?: string;
  'where.deletedAt.neq'?: string;
  'where.deletedAt.gt'?: string;
  'where.deletedAt.gte'?: string;
  'where.deletedAt.lt'?: string;
  'where.deletedAt.lte'?: string;
  'where.deletedAt.like'?: string;
  'where.deletedAt.ilike'?: string;
  'where.deletedAt.in'?: string;
  'where.deletedAt.nin'?: string;
  'where.deletedAt.contains'?: string;
  'where.deletedAt.contained'?: string;
  'where.deletedAt.overlaps'?: string;
  'where.failed.eq'?: boolean;
  'where.failed.neq'?: boolean;
  'where.failed.gt'?: boolean;
  'where.failed.gte'?: boolean;
  'where.failed.lt'?: boolean;
  'where.failed.lte'?: boolean;
  'where.failed.like'?: boolean;
  'where.failed.ilike'?: boolean;
  'where.failed.in'?: string;
  'where.failed.nin'?: string;
  'where.failed.contains'?: string;
  'where.failed.contained'?: string;
  'where.failed.overlaps'?: string;
  'where.headers.eq'?: string;
  'where.headers.neq'?: string;
  'where.headers.gt'?: string;
  'where.headers.gte'?: string;
  'where.headers.lt'?: string;
  'where.headers.lte'?: string;
  'where.headers.like'?: string;
  'where.headers.ilike'?: string;
  'where.headers.in'?: string;
  'where.headers.nin'?: string;
  'where.headers.contains'?: string;
  'where.headers.contained'?: string;
  'where.headers.overlaps'?: string;
  'where.id.eq'?: number;
  'where.id.neq'?: number;
  'where.id.gt'?: number;
  'where.id.gte'?: number;
  'where.id.lt'?: number;
  'where.id.lte'?: number;
  'where.id.like'?: number;
  'where.id.ilike'?: number;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.jobId.eq'?: number;
  'where.jobId.neq'?: number;
  'where.jobId.gt'?: number;
  'where.jobId.gte'?: number;
  'where.jobId.lt'?: number;
  'where.jobId.lte'?: number;
  'where.jobId.like'?: number;
  'where.jobId.ilike'?: number;
  'where.jobId.in'?: string;
  'where.jobId.nin'?: string;
  'where.jobId.contains'?: string;
  'where.jobId.contained'?: string;
  'where.jobId.overlaps'?: string;
  'where.method.eq'?: string;
  'where.method.neq'?: string;
  'where.method.gt'?: string;
  'where.method.gte'?: string;
  'where.method.lt'?: string;
  'where.method.lte'?: string;
  'where.method.like'?: string;
  'where.method.ilike'?: string;
  'where.method.in'?: string;
  'where.method.nin'?: string;
  'where.method.contains'?: string;
  'where.method.contained'?: string;
  'where.method.overlaps'?: string;
  'where.noReschedule.eq'?: boolean;
  'where.noReschedule.neq'?: boolean;
  'where.noReschedule.gt'?: boolean;
  'where.noReschedule.gte'?: boolean;
  'where.noReschedule.lt'?: boolean;
  'where.noReschedule.lte'?: boolean;
  'where.noReschedule.like'?: boolean;
  'where.noReschedule.ilike'?: boolean;
  'where.noReschedule.in'?: string;
  'where.noReschedule.nin'?: string;
  'where.noReschedule.contains'?: string;
  'where.noReschedule.contained'?: string;
  'where.noReschedule.overlaps'?: string;
  'where.responseBody.eq'?: string;
  'where.responseBody.neq'?: string;
  'where.responseBody.gt'?: string;
  'where.responseBody.gte'?: string;
  'where.responseBody.lt'?: string;
  'where.responseBody.lte'?: string;
  'where.responseBody.like'?: string;
  'where.responseBody.ilike'?: string;
  'where.responseBody.in'?: string;
  'where.responseBody.nin'?: string;
  'where.responseBody.contains'?: string;
  'where.responseBody.contained'?: string;
  'where.responseBody.overlaps'?: string;
  'where.responseHeaders.eq'?: string;
  'where.responseHeaders.neq'?: string;
  'where.responseHeaders.gt'?: string;
  'where.responseHeaders.gte'?: string;
  'where.responseHeaders.lt'?: string;
  'where.responseHeaders.lte'?: string;
  'where.responseHeaders.like'?: string;
  'where.responseHeaders.ilike'?: string;
  'where.responseHeaders.in'?: string;
  'where.responseHeaders.nin'?: string;
  'where.responseHeaders.contains'?: string;
  'where.responseHeaders.contained'?: string;
  'where.responseHeaders.overlaps'?: string;
  'where.responseStatusCode.eq'?: string;
  'where.responseStatusCode.neq'?: string;
  'where.responseStatusCode.gt'?: string;
  'where.responseStatusCode.gte'?: string;
  'where.responseStatusCode.lt'?: string;
  'where.responseStatusCode.lte'?: string;
  'where.responseStatusCode.like'?: string;
  'where.responseStatusCode.ilike'?: string;
  'where.responseStatusCode.in'?: string;
  'where.responseStatusCode.nin'?: string;
  'where.responseStatusCode.contains'?: string;
  'where.responseStatusCode.contained'?: string;
  'where.responseStatusCode.overlaps'?: string;
  'where.retries.eq'?: number;
  'where.retries.neq'?: number;
  'where.retries.gt'?: number;
  'where.retries.gte'?: number;
  'where.retries.lt'?: number;
  'where.retries.lte'?: number;
  'where.retries.like'?: number;
  'where.retries.ilike'?: number;
  'where.retries.in'?: string;
  'where.retries.nin'?: string;
  'where.retries.contains'?: string;
  'where.retries.contained'?: string;
  'where.retries.overlaps'?: string;
  'where.sentAt.eq'?: string;
  'where.sentAt.neq'?: string;
  'where.sentAt.gt'?: string;
  'where.sentAt.gte'?: string;
  'where.sentAt.lt'?: string;
  'where.sentAt.lte'?: string;
  'where.sentAt.like'?: string;
  'where.sentAt.ilike'?: string;
  'where.sentAt.in'?: string;
  'where.sentAt.nin'?: string;
  'where.sentAt.contains'?: string;
  'where.sentAt.contained'?: string;
  'where.sentAt.overlaps'?: string;
  'where.updatedAt.eq'?: string;
  'where.updatedAt.neq'?: string;
  'where.updatedAt.gt'?: string;
  'where.updatedAt.gte'?: string;
  'where.updatedAt.lt'?: string;
  'where.updatedAt.lte'?: string;
  'where.updatedAt.like'?: string;
  'where.updatedAt.ilike'?: string;
  'where.updatedAt.in'?: string;
  'where.updatedAt.nin'?: string;
  'where.updatedAt.contains'?: string;
  'where.updatedAt.contained'?: string;
  'where.updatedAt.overlaps'?: string;
  'where.when.eq'?: string;
  'where.when.neq'?: string;
  'where.when.gt'?: string;
  'where.when.gte'?: string;
  'where.when.lt'?: string;
  'where.when.lte'?: string;
  'where.when.like'?: string;
  'where.when.ilike'?: string;
  'where.when.in'?: string;
  'where.when.nin'?: string;
  'where.when.contains'?: string;
  'where.when.contained'?: string;
  'where.when.overlaps'?: string;
  'where.or'?: Array<string>;
  'id'?: number;
  'jobId': number;
  'when'?: string | null;
  'failed'?: boolean | null;
  'method': string;
  'body'?: string | null;
  'headers'?: object | null;
  'sentAt'?: string | null;
  'retries'?: number | null;
  'responseBody'?: string | null;
  'responseStatusCode'?: string | null;
  'noReschedule'?: boolean | null;
  'createdAt'?: string | null;
  'updatedAt'?: string | null;
  'deletedAt'?: string | null;
  'responseHeaders'?: string | null;
  'callbackUrl'?: string | null;
}

/**
 * Default Response
 */
export type UpdateMessagesResponseOK = Array<{ 'id'?: number | null; 'jobId'?: number | null; 'when'?: string | null; 'failed'?: boolean | null; 'method'?: string | null; 'body'?: string | null; 'headers'?: object | null; 'sentAt'?: string | null; 'retries'?: number | null; 'responseBody'?: string | null; 'responseStatusCode'?: string | null; 'noReschedule'?: boolean | null; 'createdAt'?: string | null; 'updatedAt'?: string | null; 'deletedAt'?: string | null; 'responseHeaders'?: string | null; 'callbackUrl'?: string | null }>
export type UpdateMessagesResponses =
  UpdateMessagesResponseOK

export type GetMessageByIdRequest = {
  'fields'?: Array<'body' | 'callbackUrl' | 'createdAt' | 'deletedAt' | 'failed' | 'headers' | 'id' | 'jobId' | 'method' | 'noReschedule' | 'responseBody' | 'responseHeaders' | 'responseStatusCode' | 'retries' | 'sentAt' | 'updatedAt' | 'when'>;
  'id': number;
}

/**
 * A Message
 */
export type GetMessageByIdResponseOK = { 'id'?: number | null; 'jobId'?: number | null; 'when'?: string | null; 'failed'?: boolean | null; 'method'?: string | null; 'body'?: string | null; 'headers'?: object | null; 'sentAt'?: string | null; 'retries'?: number | null; 'responseBody'?: string | null; 'responseStatusCode'?: string | null; 'noReschedule'?: boolean | null; 'createdAt'?: string | null; 'updatedAt'?: string | null; 'deletedAt'?: string | null; 'responseHeaders'?: string | null; 'callbackUrl'?: string | null }
export type GetMessageByIdResponses =
  GetMessageByIdResponseOK

export type UpdateMessageRequest = {
  'fields'?: Array<'body' | 'callbackUrl' | 'createdAt' | 'deletedAt' | 'failed' | 'headers' | 'id' | 'jobId' | 'method' | 'noReschedule' | 'responseBody' | 'responseHeaders' | 'responseStatusCode' | 'retries' | 'sentAt' | 'updatedAt' | 'when'>;
  'id': number;
  'jobId': number;
  'when'?: string | null;
  'failed'?: boolean | null;
  'method': string;
  'body'?: string | null;
  'headers'?: object | null;
  'sentAt'?: string | null;
  'retries'?: number | null;
  'responseBody'?: string | null;
  'responseStatusCode'?: string | null;
  'noReschedule'?: boolean | null;
  'createdAt'?: string | null;
  'updatedAt'?: string | null;
  'deletedAt'?: string | null;
  'responseHeaders'?: string | null;
  'callbackUrl'?: string | null;
}

/**
 * A Message
 */
export type UpdateMessageResponseOK = { 'id'?: number | null; 'jobId'?: number | null; 'when'?: string | null; 'failed'?: boolean | null; 'method'?: string | null; 'body'?: string | null; 'headers'?: object | null; 'sentAt'?: string | null; 'retries'?: number | null; 'responseBody'?: string | null; 'responseStatusCode'?: string | null; 'noReschedule'?: boolean | null; 'createdAt'?: string | null; 'updatedAt'?: string | null; 'deletedAt'?: string | null; 'responseHeaders'?: string | null; 'callbackUrl'?: string | null }
export type UpdateMessageResponses =
  UpdateMessageResponseOK

export type DeleteMessagesRequest = {
  'fields'?: Array<'body' | 'callbackUrl' | 'createdAt' | 'deletedAt' | 'failed' | 'headers' | 'id' | 'jobId' | 'method' | 'noReschedule' | 'responseBody' | 'responseHeaders' | 'responseStatusCode' | 'retries' | 'sentAt' | 'updatedAt' | 'when'>;
  'id': number;
}

/**
 * A Message
 */
export type DeleteMessagesResponseOK = { 'id'?: number | null; 'jobId'?: number | null; 'when'?: string | null; 'failed'?: boolean | null; 'method'?: string | null; 'body'?: string | null; 'headers'?: object | null; 'sentAt'?: string | null; 'retries'?: number | null; 'responseBody'?: string | null; 'responseStatusCode'?: string | null; 'noReschedule'?: boolean | null; 'createdAt'?: string | null; 'updatedAt'?: string | null; 'deletedAt'?: string | null; 'responseHeaders'?: string | null; 'callbackUrl'?: string | null }
export type DeleteMessagesResponses =
  DeleteMessagesResponseOK

export type GetJobForMessageRequest = {
  'fields'?: Array<'applicationId' | 'body' | 'callbackUrl' | 'createdAt' | 'deletedAt' | 'headers' | 'id' | 'jobType' | 'lastRunAt' | 'maxRetries' | 'method' | 'name' | 'nextRunAt' | 'paused' | 'protected' | 'schedule' | 'status' | 'updatedAt'>;
  'id': number;
}

/**
 * A Job
 */
export type GetJobForMessageResponseOK = { 'id'?: number | null; 'name'?: string | null; 'schedule'?: string | null; 'callbackUrl'?: string | null; 'method'?: string | null; 'body'?: string | null; 'headers'?: object | null; 'maxRetries'?: number | null; 'paused'?: boolean | null; 'protected'?: boolean | null; 'applicationId'?: string | null; 'status'?: string | null; 'createdAt'?: string | null; 'updatedAt'?: string | null; 'deletedAt'?: string | null; 'lastRunAt'?: string | null; 'nextRunAt'?: string | null; 'jobType'?: 'ICC' | 'WATT' | 'USER' | null }
export type GetJobForMessageResponses =
  GetJobForMessageResponseOK

export type GetIccJobsNameRequest = {
  'name': string;
}

export type GetIccJobsNameResponseOK = unknown
export type GetIccJobsNameResponses =
  FullResponse<GetIccJobsNameResponseOK, 200>

export type PutIccJobsNameRequest = {
  'name': string;
  'schedule': string | null;
}

export type PutIccJobsNameResponseOK = unknown
export type PutIccJobsNameResponses =
  FullResponse<PutIccJobsNameResponseOK, 200>

export type GetIccJobsRequest = {
  
}

export type GetIccJobsResponseOK = unknown
export type GetIccJobsResponses =
  FullResponse<GetIccJobsResponseOK, 200>

export type PutIccJobsRequest = {
  'type': unknown;
}

export type PutIccJobsResponseOK = unknown
export type PutIccJobsResponses =
  FullResponse<PutIccJobsResponseOK, 200>

export type GetJobsIdRunRequest = {
  'id': string;
}

export type GetJobsIdRunResponseOK = unknown
export type GetJobsIdRunResponses =
  FullResponse<GetJobsIdRunResponseOK, 200>

export type GetJobsIdPauseRequest = {
  'id': string;
}

export type GetJobsIdPauseResponseOK = unknown
export type GetJobsIdPauseResponses =
  FullResponse<GetJobsIdPauseResponseOK, 200>

export type GetJobsIdResumeRequest = {
  'id': string;
}

export type GetJobsIdResumeResponseOK = unknown
export type GetJobsIdResumeResponses =
  FullResponse<GetJobsIdResumeResponseOK, 200>

export type GetMessagesIdCancelRequest = {
  'id': string;
}

export type GetMessagesIdCancelResponseOK = unknown
export type GetMessagesIdCancelResponses =
  FullResponse<GetMessagesIdCancelResponseOK, 200>

export type PutWattJobsRequest = {
  'name'?: string;
  'callbackUrl'?: string;
  'schedule': string;
  'method'?: string | null;
  'maxRetries'?: number | null;
  'body'?: object | null;
  'headers'?: object | null;
  'applicationId'?: string | null;
}

export type PutWattJobsResponseOK = unknown
export type PutWattJobsResponses =
  FullResponse<PutWattJobsResponseOK, 200>



export interface Cron {
  setBaseUrl(newUrl: string): void;
  setDefaultHeaders(headers: object): void;
  setDefaultFetchParams(fetchParams: RequestInit): void;
  /**
   * Get jobs.
   *
   * Fetch jobs from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getJobs(req: GetJobsRequest): Promise<GetJobsResponses>;
  /**
   * Create job.
   *
   * Add new job to the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  createJob(req: CreateJobRequest): Promise<CreateJobResponses>;
  /**
   * Update jobs.
   *
   * Update one or more jobs in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateJobs(req: UpdateJobsRequest): Promise<UpdateJobsResponses>;
  /**
   * Get Job by id.
   *
   * Fetch Job using its id from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getJobById(req: GetJobByIdRequest): Promise<GetJobByIdResponses>;
  /**
   * Update job.
   *
   * Update job in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateJob(req: UpdateJobRequest): Promise<UpdateJobResponses>;
  /**
   * Delete jobs.
   *
   * Delete one or more jobs from the Database.
   * @param req - request parameters object
   * @returns the API response body
   */
  deleteJobs(req: DeleteJobsRequest): Promise<DeleteJobsResponses>;
  /**
   * Get messages for job.
   *
   * Fetch all the messages for job from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getMessagesForJob(req: GetMessagesForJobRequest): Promise<GetMessagesForJobResponses>;
  /**
   * Get messages.
   *
   * Fetch messages from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getMessages(req: GetMessagesRequest): Promise<GetMessagesResponses>;
  /**
   * Create message.
   *
   * Add new message to the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  createMessage(req: CreateMessageRequest): Promise<CreateMessageResponses>;
  /**
   * Update messages.
   *
   * Update one or more messages in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateMessages(req: UpdateMessagesRequest): Promise<UpdateMessagesResponses>;
  /**
   * Get Message by id.
   *
   * Fetch Message using its id from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getMessageById(req: GetMessageByIdRequest): Promise<GetMessageByIdResponses>;
  /**
   * Update message.
   *
   * Update message in the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  updateMessage(req: UpdateMessageRequest): Promise<UpdateMessageResponses>;
  /**
   * Delete messages.
   *
   * Delete one or more messages from the Database.
   * @param req - request parameters object
   * @returns the API response body
   */
  deleteMessages(req: DeleteMessagesRequest): Promise<DeleteMessagesResponses>;
  /**
   * Get job for message.
   *
   * Fetch the job for message from the database.
   * @param req - request parameters object
   * @returns the API response body
   */
  getJobForMessage(req: GetJobForMessageRequest): Promise<GetJobForMessageResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  getIccJobsName(req: GetIccJobsNameRequest): Promise<GetIccJobsNameResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  putIccJobsName(req: PutIccJobsNameRequest): Promise<PutIccJobsNameResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  getIccJobs(req: GetIccJobsRequest): Promise<GetIccJobsResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  putIccJobs(req: PutIccJobsRequest): Promise<PutIccJobsResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  getJobsIdRun(req: GetJobsIdRunRequest): Promise<GetJobsIdRunResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  getJobsIdPause(req: GetJobsIdPauseRequest): Promise<GetJobsIdPauseResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  getJobsIdResume(req: GetJobsIdResumeRequest): Promise<GetJobsIdResumeResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  getMessagesIdCancel(req: GetMessagesIdCancelRequest): Promise<GetMessagesIdCancelResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  putWattJobs(req: PutWattJobsRequest): Promise<PutWattJobsResponses>;
}
type PlatformaticFrontendClient = Omit<Cron, 'setBaseUrl'>
type BuildOptions = {
  headers?: object
}
export default function build(url: string, options?: BuildOptions): PlatformaticFrontendClient
