import { FastifyPluginAsync } from 'fastify'

interface GetMoviesRequest {
  'limit'?: number;
  'offset'?: number;
  'totalCount'?: boolean;
  'fields'?: Array<string>;
  'where.id.eq'?: number;
  'where.id.neq'?: number;
  'where.id.gt'?: number;
  'where.id.gte'?: number;
  'where.id.lt'?: number;
  'where.id.lte'?: number;
  'where.id.like'?: number;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.title.eq'?: string;
  'where.title.neq'?: string;
  'where.title.gt'?: string;
  'where.title.gte'?: string;
  'where.title.lt'?: string;
  'where.title.lte'?: string;
  'where.title.like'?: string;
  'where.title.in'?: string;
  'where.title.nin'?: string;
  'where.or'?: Array<string>;
  'orderby.id'?: string;
  'orderby.title'?: string;
}

interface GetMoviesResponseOK {
  'id'?: number;
  'title': string;
}

interface CreateMovieRequest {
  'id'?: number;
  'title': string;
}

interface CreateMovieResponseOK {
  'id'?: number;
  'title': string;
}

interface UpdateMoviesRequest {
  'fields'?: Array<string>;
  'where.id.eq'?: number;
  'where.id.neq'?: number;
  'where.id.gt'?: number;
  'where.id.gte'?: number;
  'where.id.lt'?: number;
  'where.id.lte'?: number;
  'where.id.like'?: number;
  'where.id.in'?: string;
  'where.id.nin'?: string;
  'where.title.eq'?: string;
  'where.title.neq'?: string;
  'where.title.gt'?: string;
  'where.title.gte'?: string;
  'where.title.lt'?: string;
  'where.title.lte'?: string;
  'where.title.like'?: string;
  'where.title.in'?: string;
  'where.title.nin'?: string;
  'where.or'?: Array<string>;
  'id'?: number;
  'title': string;
}

interface UpdateMoviesResponseOK {
  'id'?: number;
  'title': string;
}

interface GetMovieByIdRequest {
  'fields'?: Array<string>;
  'id': number;
}

interface GetMovieByIdResponseOK {
  'id'?: number;
  'title': string;
}

interface UpdateMovieRequest {
  'fields'?: Array<string>;
  'id': number;
  'title': string;
}

interface UpdateMovieResponseOK {
  'id'?: number;
  'title': string;
}

interface DeleteMoviesRequest {
  'fields'?: Array<string>;
  'id': number;
}

interface DeleteMoviesResponseOK {
  'id'?: number;
  'title': string;
}

interface Client {
  getMovies(req: GetMoviesRequest): Promise<Array<GetMoviesResponseOK>>;
  createMovie(req: CreateMovieRequest): Promise<CreateMovieResponseOK>;
  updateMovies(req: UpdateMoviesRequest): Promise<Array<UpdateMoviesResponseOK>>;
  getMovieById(req: GetMovieByIdRequest): Promise<GetMovieByIdResponseOK>;
  updateMovie(req: UpdateMovieRequest): Promise<UpdateMovieResponseOK>;
  deleteMovies(req: DeleteMoviesRequest): Promise<DeleteMoviesResponseOK>;
}

type ClientPlugin = FastifyPluginAsync<NonNullable<client.ClientOptions>>

declare module 'fastify' {
  interface ConfigureClient {
    getHeaders(req: FastifyRequest, reply: FastifyReply): Promise<Record<string,string>>;
  }
  interface FastifyInstance {
    'client': Client;
    configureClient(opts: ConfigureClient): unknown
  }

  interface FastifyRequest {
    'client': Client;
  }
}

declare namespace client {
  export interface ClientOptions {
    url: string
  }
  export const client: ClientPlugin;
  export { client as default };
}

declare function client(...params: Parameters<ClientPlugin>): ReturnType<ClientPlugin>;
export = client;
