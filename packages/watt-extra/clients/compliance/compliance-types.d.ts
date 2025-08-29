export interface FullResponse<T, U extends number> {
  'statusCode': U;
  'headers': object;
  'body': T;
}

export type GetReportsRequest = {
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<'applicationId' | 'bundleId' | 'createdAt' | 'id' | 'result' | 'ruleSet'>;
  'where.applicationId.eq'?: string;
  'where.applicationId.neq'?: string;
  'where.applicationId.gt'?: string;
  'where.applicationId.gte'?: string;
  'where.applicationId.lt'?: string;
  'where.applicationId.lte'?: string;
  'where.applicationId.like'?: string;
  'where.applicationId.in'?: string;
  'where.applicationId.nin'?: string;
  'where.applicationId.contains'?: string;
  'where.applicationId.contained'?: string;
  'where.applicationId.overlaps'?: string;
  'where.bundleId.eq'?: string;
  'where.bundleId.neq'?: string;
  'where.bundleId.gt'?: string;
  'where.bundleId.gte'?: string;
  'where.bundleId.lt'?: string;
  'where.bundleId.lte'?: string;
  'where.bundleId.like'?: string;
  'where.bundleId.in'?: string;
  'where.bundleId.nin'?: string;
  'where.bundleId.contains'?: string;
  'where.bundleId.contained'?: string;
  'where.bundleId.overlaps'?: string;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
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
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.result.eq'?: boolean;
  'where.result.neq'?: boolean;
  'where.result.gt'?: boolean;
  'where.result.gte'?: boolean;
  'where.result.lt'?: boolean;
  'where.result.lte'?: boolean;
  'where.result.like'?: boolean;
  'where.result.in'?: string;
  'where.result.nin'?: string;
  'where.result.contains'?: string;
  'where.result.contained'?: string;
  'where.result.overlaps'?: string;
  'where.ruleSet.eq'?: string;
  'where.ruleSet.neq'?: string;
  'where.ruleSet.gt'?: string;
  'where.ruleSet.gte'?: string;
  'where.ruleSet.lt'?: string;
  'where.ruleSet.lte'?: string;
  'where.ruleSet.like'?: string;
  'where.ruleSet.in'?: string;
  'where.ruleSet.nin'?: string;
  'where.ruleSet.contains'?: string;
  'where.ruleSet.contained'?: string;
  'where.ruleSet.overlaps'?: string;
  'where.or'?: Array<string>;
  'orderby.applicationId'?: 'asc' | 'desc';
  'orderby.bundleId'?: 'asc' | 'desc';
  'orderby.createdAt'?: 'asc' | 'desc';
  'orderby.id'?: 'asc' | 'desc';
  'orderby.result'?: 'asc' | 'desc';
  'orderby.ruleSet'?: 'asc' | 'desc';
}

export type GetReportsResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'bundleId'?: string | null; 'result'?: boolean | null; 'ruleSet'?: object; 'createdAt'?: string | null }>
export type GetReportsResponses =
  GetReportsResponseOK

export type CreateReportRequest = {
  'id'?: string;
  'applicationId'?: string | null;
  'bundleId'?: string | null;
  'result': boolean;
  'ruleSet': object;
  'createdAt'?: string | null;
}

export type CreateReportResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'bundleId'?: string | null; 'result'?: boolean | null; 'ruleSet'?: object; 'createdAt'?: string | null }
export type CreateReportResponses =
  CreateReportResponseOK

export type UpdateReportsRequest = {
  'fields'?: Array<'applicationId' | 'bundleId' | 'createdAt' | 'id' | 'result' | 'ruleSet'>;
  'where.applicationId.eq'?: string;
  'where.applicationId.neq'?: string;
  'where.applicationId.gt'?: string;
  'where.applicationId.gte'?: string;
  'where.applicationId.lt'?: string;
  'where.applicationId.lte'?: string;
  'where.applicationId.like'?: string;
  'where.applicationId.in'?: string;
  'where.applicationId.nin'?: string;
  'where.applicationId.contains'?: string;
  'where.applicationId.contained'?: string;
  'where.applicationId.overlaps'?: string;
  'where.bundleId.eq'?: string;
  'where.bundleId.neq'?: string;
  'where.bundleId.gt'?: string;
  'where.bundleId.gte'?: string;
  'where.bundleId.lt'?: string;
  'where.bundleId.lte'?: string;
  'where.bundleId.like'?: string;
  'where.bundleId.in'?: string;
  'where.bundleId.nin'?: string;
  'where.bundleId.contains'?: string;
  'where.bundleId.contained'?: string;
  'where.bundleId.overlaps'?: string;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
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
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.result.eq'?: boolean;
  'where.result.neq'?: boolean;
  'where.result.gt'?: boolean;
  'where.result.gte'?: boolean;
  'where.result.lt'?: boolean;
  'where.result.lte'?: boolean;
  'where.result.like'?: boolean;
  'where.result.in'?: string;
  'where.result.nin'?: string;
  'where.result.contains'?: string;
  'where.result.contained'?: string;
  'where.result.overlaps'?: string;
  'where.ruleSet.eq'?: string;
  'where.ruleSet.neq'?: string;
  'where.ruleSet.gt'?: string;
  'where.ruleSet.gte'?: string;
  'where.ruleSet.lt'?: string;
  'where.ruleSet.lte'?: string;
  'where.ruleSet.like'?: string;
  'where.ruleSet.in'?: string;
  'where.ruleSet.nin'?: string;
  'where.ruleSet.contains'?: string;
  'where.ruleSet.contained'?: string;
  'where.ruleSet.overlaps'?: string;
  'where.or'?: Array<string>;
  'id'?: string;
  'applicationId'?: string | null;
  'bundleId'?: string | null;
  'result': boolean;
  'ruleSet': object;
  'createdAt'?: string | null;
}

export type UpdateReportsResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'bundleId'?: string | null; 'result'?: boolean | null; 'ruleSet'?: object; 'createdAt'?: string | null }>
export type UpdateReportsResponses =
  UpdateReportsResponseOK

export type GetReportByIdRequest = {
  'fields'?: Array<'applicationId' | 'bundleId' | 'createdAt' | 'id' | 'result' | 'ruleSet'>;
  'id': string;
}

export type GetReportByIdResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'bundleId'?: string | null; 'result'?: boolean | null; 'ruleSet'?: object; 'createdAt'?: string | null }
export type GetReportByIdResponses =
  GetReportByIdResponseOK

export type UpdateReportRequest = {
  'fields'?: Array<'applicationId' | 'bundleId' | 'createdAt' | 'id' | 'result' | 'ruleSet'>;
  'id': string;
  'applicationId'?: string | null;
  'bundleId'?: string | null;
  'result': boolean;
  'ruleSet': object;
  'createdAt'?: string | null;
}

export type UpdateReportResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'bundleId'?: string | null; 'result'?: boolean | null; 'ruleSet'?: object; 'createdAt'?: string | null }
export type UpdateReportResponses =
  UpdateReportResponseOK

export type DeleteReportsRequest = {
  'fields'?: Array<'applicationId' | 'bundleId' | 'createdAt' | 'id' | 'result' | 'ruleSet'>;
  'id': string;
}

export type DeleteReportsResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'bundleId'?: string | null; 'result'?: boolean | null; 'ruleSet'?: object; 'createdAt'?: string | null }
export type DeleteReportsResponses =
  DeleteReportsResponseOK

export type CreateRuleRequest = {
  'id'?: string;
  'name'?: string | null;
  'description'?: string | null;
  'label'?: string | null;
  'config': object;
  'createdAt'?: string | null;
}

export type CreateRuleResponseOK = { 'id'?: string | null; 'name'?: string | null; 'description'?: string | null; 'label'?: string | null; 'config'?: object; 'createdAt'?: string | null }
export type CreateRuleResponses =
  CreateRuleResponseOK

export type UpdateRulesRequest = {
  'fields'?: Array<'config' | 'createdAt' | 'description' | 'id' | 'label' | 'name'>;
  'where.config.eq'?: string;
  'where.config.neq'?: string;
  'where.config.gt'?: string;
  'where.config.gte'?: string;
  'where.config.lt'?: string;
  'where.config.lte'?: string;
  'where.config.like'?: string;
  'where.config.in'?: string;
  'where.config.nin'?: string;
  'where.config.contains'?: string;
  'where.config.contained'?: string;
  'where.config.overlaps'?: string;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.description.eq'?: string;
  'where.description.neq'?: string;
  'where.description.gt'?: string;
  'where.description.gte'?: string;
  'where.description.lt'?: string;
  'where.description.lte'?: string;
  'where.description.like'?: string;
  'where.description.in'?: string;
  'where.description.nin'?: string;
  'where.description.contains'?: string;
  'where.description.contained'?: string;
  'where.description.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.label.eq'?: string;
  'where.label.neq'?: string;
  'where.label.gt'?: string;
  'where.label.gte'?: string;
  'where.label.lt'?: string;
  'where.label.lte'?: string;
  'where.label.like'?: string;
  'where.label.in'?: string;
  'where.label.nin'?: string;
  'where.label.contains'?: string;
  'where.label.contained'?: string;
  'where.label.overlaps'?: string;
  'where.name.eq'?: string;
  'where.name.neq'?: string;
  'where.name.gt'?: string;
  'where.name.gte'?: string;
  'where.name.lt'?: string;
  'where.name.lte'?: string;
  'where.name.like'?: string;
  'where.name.in'?: string;
  'where.name.nin'?: string;
  'where.name.contains'?: string;
  'where.name.contained'?: string;
  'where.name.overlaps'?: string;
  'where.or'?: Array<string>;
  'id'?: string;
  'name'?: string | null;
  'description'?: string | null;
  'label'?: string | null;
  'config': object;
  'createdAt'?: string | null;
}

export type UpdateRulesResponseOK = Array<{ 'id'?: string | null; 'name'?: string | null; 'description'?: string | null; 'label'?: string | null; 'config'?: object; 'createdAt'?: string | null }>
export type UpdateRulesResponses =
  UpdateRulesResponseOK

export type GetRuleByIdRequest = {
  'fields'?: Array<'config' | 'createdAt' | 'description' | 'id' | 'label' | 'name'>;
  'id': string;
}

export type GetRuleByIdResponseOK = { 'id'?: string | null; 'name'?: string | null; 'description'?: string | null; 'label'?: string | null; 'config'?: object; 'createdAt'?: string | null }
export type GetRuleByIdResponses =
  GetRuleByIdResponseOK

export type UpdateRuleRequest = {
  'fields'?: Array<'config' | 'createdAt' | 'description' | 'id' | 'label' | 'name'>;
  'id': string;
  'name'?: string | null;
  'description'?: string | null;
  'label'?: string | null;
  'config': object;
  'createdAt'?: string | null;
}

export type UpdateRuleResponseOK = { 'id'?: string | null; 'name'?: string | null; 'description'?: string | null; 'label'?: string | null; 'config'?: object; 'createdAt'?: string | null }
export type UpdateRuleResponses =
  UpdateRuleResponseOK

export type DeleteRulesRequest = {
  'fields'?: Array<'config' | 'createdAt' | 'description' | 'id' | 'label' | 'name'>;
  'id': string;
}

export type DeleteRulesResponseOK = { 'id'?: string | null; 'name'?: string | null; 'description'?: string | null; 'label'?: string | null; 'config'?: object; 'createdAt'?: string | null }
export type DeleteRulesResponses =
  DeleteRulesResponseOK

export type GetRuleConfigsForRuleRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'enabled' | 'id' | 'options' | 'ruleId' | 'type'>;
  'id': string;
}

export type GetRuleConfigsForRuleResponseOK = Array<{ 'id'?: string | null; 'type'?: 'global' | 'local'; 'applicationId'?: string | null; 'enabled'?: boolean | null; 'ruleId'?: string | null; 'options'?: object; 'createdAt'?: string | null }>
export type GetRuleConfigsForRuleResponses =
  GetRuleConfigsForRuleResponseOK

export type GetRuleConfigsRequest = {
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<'applicationId' | 'createdAt' | 'enabled' | 'id' | 'options' | 'ruleId' | 'type'>;
  'where.applicationId.eq'?: string;
  'where.applicationId.neq'?: string;
  'where.applicationId.gt'?: string;
  'where.applicationId.gte'?: string;
  'where.applicationId.lt'?: string;
  'where.applicationId.lte'?: string;
  'where.applicationId.like'?: string;
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
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.enabled.eq'?: boolean;
  'where.enabled.neq'?: boolean;
  'where.enabled.gt'?: boolean;
  'where.enabled.gte'?: boolean;
  'where.enabled.lt'?: boolean;
  'where.enabled.lte'?: boolean;
  'where.enabled.like'?: boolean;
  'where.enabled.in'?: string;
  'where.enabled.nin'?: string;
  'where.enabled.contains'?: string;
  'where.enabled.contained'?: string;
  'where.enabled.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.options.eq'?: string;
  'where.options.neq'?: string;
  'where.options.gt'?: string;
  'where.options.gte'?: string;
  'where.options.lt'?: string;
  'where.options.lte'?: string;
  'where.options.like'?: string;
  'where.options.in'?: string;
  'where.options.nin'?: string;
  'where.options.contains'?: string;
  'where.options.contained'?: string;
  'where.options.overlaps'?: string;
  'where.ruleId.eq'?: string;
  'where.ruleId.neq'?: string;
  'where.ruleId.gt'?: string;
  'where.ruleId.gte'?: string;
  'where.ruleId.lt'?: string;
  'where.ruleId.lte'?: string;
  'where.ruleId.like'?: string;
  'where.ruleId.in'?: string;
  'where.ruleId.nin'?: string;
  'where.ruleId.contains'?: string;
  'where.ruleId.contained'?: string;
  'where.ruleId.overlaps'?: string;
  'where.type.eq'?: 'global' | 'local';
  'where.type.neq'?: 'global' | 'local';
  'where.type.gt'?: 'global' | 'local';
  'where.type.gte'?: 'global' | 'local';
  'where.type.lt'?: 'global' | 'local';
  'where.type.lte'?: 'global' | 'local';
  'where.type.like'?: 'global' | 'local';
  'where.type.in'?: string;
  'where.type.nin'?: string;
  'where.type.contains'?: string;
  'where.type.contained'?: string;
  'where.type.overlaps'?: string;
  'where.or'?: Array<string>;
  'orderby.applicationId'?: 'asc' | 'desc';
  'orderby.createdAt'?: 'asc' | 'desc';
  'orderby.enabled'?: 'asc' | 'desc';
  'orderby.id'?: 'asc' | 'desc';
  'orderby.options'?: 'asc' | 'desc';
  'orderby.ruleId'?: 'asc' | 'desc';
  'orderby.type'?: 'asc' | 'desc';
}

export type GetRuleConfigsResponseOK = Array<{ 'id'?: string | null; 'type'?: 'global' | 'local'; 'applicationId'?: string | null; 'enabled'?: boolean | null; 'ruleId'?: string | null; 'options'?: object; 'createdAt'?: string | null }>
export type GetRuleConfigsResponses =
  GetRuleConfigsResponseOK

export type CreateRuleConfigRequest = {
  'id'?: string;
  'type': 'global' | 'local';
  'applicationId'?: string | null;
  'enabled'?: boolean | null;
  'ruleId': string;
  'options': object;
  'createdAt'?: string | null;
}

export type CreateRuleConfigResponseOK = { 'id'?: string | null; 'type'?: 'global' | 'local'; 'applicationId'?: string | null; 'enabled'?: boolean | null; 'ruleId'?: string | null; 'options'?: object; 'createdAt'?: string | null }
export type CreateRuleConfigResponses =
  CreateRuleConfigResponseOK

export type UpdateRuleConfigsRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'enabled' | 'id' | 'options' | 'ruleId' | 'type'>;
  'where.applicationId.eq'?: string;
  'where.applicationId.neq'?: string;
  'where.applicationId.gt'?: string;
  'where.applicationId.gte'?: string;
  'where.applicationId.lt'?: string;
  'where.applicationId.lte'?: string;
  'where.applicationId.like'?: string;
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
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.enabled.eq'?: boolean;
  'where.enabled.neq'?: boolean;
  'where.enabled.gt'?: boolean;
  'where.enabled.gte'?: boolean;
  'where.enabled.lt'?: boolean;
  'where.enabled.lte'?: boolean;
  'where.enabled.like'?: boolean;
  'where.enabled.in'?: string;
  'where.enabled.nin'?: string;
  'where.enabled.contains'?: string;
  'where.enabled.contained'?: string;
  'where.enabled.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.options.eq'?: string;
  'where.options.neq'?: string;
  'where.options.gt'?: string;
  'where.options.gte'?: string;
  'where.options.lt'?: string;
  'where.options.lte'?: string;
  'where.options.like'?: string;
  'where.options.in'?: string;
  'where.options.nin'?: string;
  'where.options.contains'?: string;
  'where.options.contained'?: string;
  'where.options.overlaps'?: string;
  'where.ruleId.eq'?: string;
  'where.ruleId.neq'?: string;
  'where.ruleId.gt'?: string;
  'where.ruleId.gte'?: string;
  'where.ruleId.lt'?: string;
  'where.ruleId.lte'?: string;
  'where.ruleId.like'?: string;
  'where.ruleId.in'?: string;
  'where.ruleId.nin'?: string;
  'where.ruleId.contains'?: string;
  'where.ruleId.contained'?: string;
  'where.ruleId.overlaps'?: string;
  'where.type.eq'?: 'global' | 'local';
  'where.type.neq'?: 'global' | 'local';
  'where.type.gt'?: 'global' | 'local';
  'where.type.gte'?: 'global' | 'local';
  'where.type.lt'?: 'global' | 'local';
  'where.type.lte'?: 'global' | 'local';
  'where.type.like'?: 'global' | 'local';
  'where.type.in'?: string;
  'where.type.nin'?: string;
  'where.type.contains'?: string;
  'where.type.contained'?: string;
  'where.type.overlaps'?: string;
  'where.or'?: Array<string>;
  'id'?: string;
  'type': 'global' | 'local';
  'applicationId'?: string | null;
  'enabled'?: boolean | null;
  'ruleId': string;
  'options': object;
  'createdAt'?: string | null;
}

export type UpdateRuleConfigsResponseOK = Array<{ 'id'?: string | null; 'type'?: 'global' | 'local'; 'applicationId'?: string | null; 'enabled'?: boolean | null; 'ruleId'?: string | null; 'options'?: object; 'createdAt'?: string | null }>
export type UpdateRuleConfigsResponses =
  UpdateRuleConfigsResponseOK

export type GetRuleConfigByIdRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'enabled' | 'id' | 'options' | 'ruleId' | 'type'>;
  'id': string;
}

export type GetRuleConfigByIdResponseOK = { 'id'?: string | null; 'type'?: 'global' | 'local'; 'applicationId'?: string | null; 'enabled'?: boolean | null; 'ruleId'?: string | null; 'options'?: object; 'createdAt'?: string | null }
export type GetRuleConfigByIdResponses =
  GetRuleConfigByIdResponseOK

export type UpdateRuleConfigRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'enabled' | 'id' | 'options' | 'ruleId' | 'type'>;
  'id': string;
  'type': 'global' | 'local';
  'applicationId'?: string | null;
  'enabled'?: boolean | null;
  'ruleId': string;
  'options': object;
  'createdAt'?: string | null;
}

export type UpdateRuleConfigResponseOK = { 'id'?: string | null; 'type'?: 'global' | 'local'; 'applicationId'?: string | null; 'enabled'?: boolean | null; 'ruleId'?: string | null; 'options'?: object; 'createdAt'?: string | null }
export type UpdateRuleConfigResponses =
  UpdateRuleConfigResponseOK

export type DeleteRuleConfigsRequest = {
  'fields'?: Array<'applicationId' | 'createdAt' | 'enabled' | 'id' | 'options' | 'ruleId' | 'type'>;
  'id': string;
}

export type DeleteRuleConfigsResponseOK = { 'id'?: string | null; 'type'?: 'global' | 'local'; 'applicationId'?: string | null; 'enabled'?: boolean | null; 'ruleId'?: string | null; 'options'?: object; 'createdAt'?: string | null }
export type DeleteRuleConfigsResponses =
  DeleteRuleConfigsResponseOK

export type GetRuleForRuleConfigRequest = {
  'fields'?: Array<'config' | 'createdAt' | 'description' | 'id' | 'label' | 'name'>;
  'id': string;
}

export type GetRuleForRuleConfigResponseOK = { 'id'?: string | null; 'name'?: string | null; 'description'?: string | null; 'label'?: string | null; 'config'?: object; 'createdAt'?: string | null }
export type GetRuleForRuleConfigResponses =
  GetRuleForRuleConfigResponseOK

export type GetMetadataRequest = {
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<'applicationId' | 'bundleId' | 'createdAt' | 'data' | 'id'>;
  'where.applicationId.eq'?: string;
  'where.applicationId.neq'?: string;
  'where.applicationId.gt'?: string;
  'where.applicationId.gte'?: string;
  'where.applicationId.lt'?: string;
  'where.applicationId.lte'?: string;
  'where.applicationId.like'?: string;
  'where.applicationId.in'?: string;
  'where.applicationId.nin'?: string;
  'where.applicationId.contains'?: string;
  'where.applicationId.contained'?: string;
  'where.applicationId.overlaps'?: string;
  'where.bundleId.eq'?: string;
  'where.bundleId.neq'?: string;
  'where.bundleId.gt'?: string;
  'where.bundleId.gte'?: string;
  'where.bundleId.lt'?: string;
  'where.bundleId.lte'?: string;
  'where.bundleId.like'?: string;
  'where.bundleId.in'?: string;
  'where.bundleId.nin'?: string;
  'where.bundleId.contains'?: string;
  'where.bundleId.contained'?: string;
  'where.bundleId.overlaps'?: string;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.data.eq'?: string;
  'where.data.neq'?: string;
  'where.data.gt'?: string;
  'where.data.gte'?: string;
  'where.data.lt'?: string;
  'where.data.lte'?: string;
  'where.data.like'?: string;
  'where.data.in'?: string;
  'where.data.nin'?: string;
  'where.data.contains'?: string;
  'where.data.contained'?: string;
  'where.data.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.or'?: Array<string>;
  'orderby.applicationId'?: 'asc' | 'desc';
  'orderby.bundleId'?: 'asc' | 'desc';
  'orderby.createdAt'?: 'asc' | 'desc';
  'orderby.data'?: 'asc' | 'desc';
  'orderby.id'?: 'asc' | 'desc';
}

export type GetMetadataResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'bundleId'?: string | null; 'data'?: object; 'createdAt'?: string | null }>
export type GetMetadataResponses =
  GetMetadataResponseOK

export type UpdateMetadataRequest = {
  'fields'?: Array<'applicationId' | 'bundleId' | 'createdAt' | 'data' | 'id'>;
  'where.applicationId.eq'?: string;
  'where.applicationId.neq'?: string;
  'where.applicationId.gt'?: string;
  'where.applicationId.gte'?: string;
  'where.applicationId.lt'?: string;
  'where.applicationId.lte'?: string;
  'where.applicationId.like'?: string;
  'where.applicationId.in'?: string;
  'where.applicationId.nin'?: string;
  'where.applicationId.contains'?: string;
  'where.applicationId.contained'?: string;
  'where.applicationId.overlaps'?: string;
  'where.bundleId.eq'?: string;
  'where.bundleId.neq'?: string;
  'where.bundleId.gt'?: string;
  'where.bundleId.gte'?: string;
  'where.bundleId.lt'?: string;
  'where.bundleId.lte'?: string;
  'where.bundleId.like'?: string;
  'where.bundleId.in'?: string;
  'where.bundleId.nin'?: string;
  'where.bundleId.contains'?: string;
  'where.bundleId.contained'?: string;
  'where.bundleId.overlaps'?: string;
  'where.createdAt.eq'?: string;
  'where.createdAt.neq'?: string;
  'where.createdAt.gt'?: string;
  'where.createdAt.gte'?: string;
  'where.createdAt.lt'?: string;
  'where.createdAt.lte'?: string;
  'where.createdAt.like'?: string;
  'where.createdAt.in'?: string;
  'where.createdAt.nin'?: string;
  'where.createdAt.contains'?: string;
  'where.createdAt.contained'?: string;
  'where.createdAt.overlaps'?: string;
  'where.data.eq'?: string;
  'where.data.neq'?: string;
  'where.data.gt'?: string;
  'where.data.gte'?: string;
  'where.data.lt'?: string;
  'where.data.lte'?: string;
  'where.data.like'?: string;
  'where.data.in'?: string;
  'where.data.nin'?: string;
  'where.data.contains'?: string;
  'where.data.contained'?: string;
  'where.data.overlaps'?: string;
  'where.id.eq'?: string;
  'where.id.neq'?: string;
  'where.id.gt'?: string;
  'where.id.gte'?: string;
  'where.id.lt'?: string;
  'where.id.lte'?: string;
  'where.id.like'?: string;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.id.contains'?: string;
  'where.id.contained'?: string;
  'where.id.overlaps'?: string;
  'where.or'?: Array<string>;
  'id'?: string;
  'applicationId'?: string | null;
  'bundleId'?: string | null;
  'data': object;
  'createdAt'?: string | null;
}

export type UpdateMetadataResponseOK = Array<{ 'id'?: string | null; 'applicationId'?: string | null; 'bundleId'?: string | null; 'data'?: object; 'createdAt'?: string | null }>
export type UpdateMetadataResponses =
  UpdateMetadataResponseOK

export type GetMetadatumByIdRequest = {
  'fields'?: Array<'applicationId' | 'bundleId' | 'createdAt' | 'data' | 'id'>;
  'id': string;
}

export type GetMetadatumByIdResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'bundleId'?: string | null; 'data'?: object; 'createdAt'?: string | null }
export type GetMetadatumByIdResponses =
  GetMetadatumByIdResponseOK

export type UpdateMetadatumRequest = {
  'fields'?: Array<'applicationId' | 'bundleId' | 'createdAt' | 'data' | 'id'>;
  'id': string;
  'applicationId'?: string | null;
  'bundleId'?: string | null;
  'data': object;
  'createdAt'?: string | null;
}

export type UpdateMetadatumResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'bundleId'?: string | null; 'data'?: object; 'createdAt'?: string | null }
export type UpdateMetadatumResponses =
  UpdateMetadatumResponseOK

export type DeleteMetadataRequest = {
  'fields'?: Array<'applicationId' | 'bundleId' | 'createdAt' | 'data' | 'id'>;
  'id': string;
}

export type DeleteMetadataResponseOK = { 'id'?: string | null; 'applicationId'?: string | null; 'bundleId'?: string | null; 'data'?: object; 'createdAt'?: string | null }
export type DeleteMetadataResponses =
  DeleteMetadataResponseOK

export type PostComplianceRequest = {
  'applicationId': string;
  'bundleId': string;
}

export type PostComplianceResponseOK = unknown
export type PostComplianceResponses =
  FullResponse<PostComplianceResponseOK, 200>

export type PostMetadataRequest = {
  'applicationId': string;
  'bundleId': string;
  'data': object;
}

export type PostMetadataResponseOK = unknown
export type PostMetadataResponses =
  FullResponse<PostMetadataResponseOK, 200>

export type PostRulesNameRequest = {
  'name': string;
  'applicationId': string;
  'enabled': boolean;
  'options': object;
}

export type PostRulesNameResponseOK = unknown
export type PostRulesNameResponses =
  FullResponse<PostRulesNameResponseOK, 200>

export type GetRulesRequest = {
  unknown
}

export type GetRulesResponseOK = unknown
export type GetRulesResponses =
  FullResponse<GetRulesResponseOK, 200>



export interface Compliance {
  setBaseUrl(newUrl: string) : void;
  setDefaultHeaders(headers: Object) : void;
  getReports(req?: GetReportsRequest): Promise<GetReportsResponses>;
  createReport(req?: CreateReportRequest): Promise<CreateReportResponses>;
  updateReports(req?: UpdateReportsRequest): Promise<UpdateReportsResponses>;
  getReportById(req?: GetReportByIdRequest): Promise<GetReportByIdResponses>;
  updateReport(req?: UpdateReportRequest): Promise<UpdateReportResponses>;
  deleteReports(req?: DeleteReportsRequest): Promise<DeleteReportsResponses>;
  createRule(req?: CreateRuleRequest): Promise<CreateRuleResponses>;
  updateRules(req?: UpdateRulesRequest): Promise<UpdateRulesResponses>;
  getRuleById(req?: GetRuleByIdRequest): Promise<GetRuleByIdResponses>;
  updateRule(req?: UpdateRuleRequest): Promise<UpdateRuleResponses>;
  deleteRules(req?: DeleteRulesRequest): Promise<DeleteRulesResponses>;
  getRuleConfigsForRule(req?: GetRuleConfigsForRuleRequest): Promise<GetRuleConfigsForRuleResponses>;
  getRuleConfigs(req?: GetRuleConfigsRequest): Promise<GetRuleConfigsResponses>;
  createRuleConfig(req?: CreateRuleConfigRequest): Promise<CreateRuleConfigResponses>;
  updateRuleConfigs(req?: UpdateRuleConfigsRequest): Promise<UpdateRuleConfigsResponses>;
  getRuleConfigById(req?: GetRuleConfigByIdRequest): Promise<GetRuleConfigByIdResponses>;
  updateRuleConfig(req?: UpdateRuleConfigRequest): Promise<UpdateRuleConfigResponses>;
  deleteRuleConfigs(req?: DeleteRuleConfigsRequest): Promise<DeleteRuleConfigsResponses>;
  getRuleForRuleConfig(req?: GetRuleForRuleConfigRequest): Promise<GetRuleForRuleConfigResponses>;
  getMetadata(req?: GetMetadataRequest): Promise<GetMetadataResponses>;
  updateMetadata(req?: UpdateMetadataRequest): Promise<UpdateMetadataResponses>;
  getMetadatumById(req?: GetMetadatumByIdRequest): Promise<GetMetadatumByIdResponses>;
  updateMetadatum(req?: UpdateMetadatumRequest): Promise<UpdateMetadatumResponses>;
  deleteMetadata(req?: DeleteMetadataRequest): Promise<DeleteMetadataResponses>;
  postCompliance(req?: PostComplianceRequest): Promise<PostComplianceResponses>;
  postMetadata(req?: PostMetadataRequest): Promise<PostMetadataResponses>;
  postRulesName(req?: PostRulesNameRequest): Promise<PostRulesNameResponses>;
  getRules(req?: GetRulesRequest): Promise<GetRulesResponses>;
}
type PlatformaticFrontendClient = Omit<Compliance, 'setBaseUrl'>
type BuildOptions = {
  headers?: Object
}
export default function build(url: string, options?: BuildOptions): PlatformaticFrontendClient
