interface FullResponse<T> {
  'statusCode': number;
  'headers': object;
  'body': T;
}

interface GetHelloRequest {
}

interface GetHelloResponseOK {
}

interface GetFooRequest {
}

interface GetFooResponseOK {
}

export interface Api {
  setBaseUrl(newUrl: string) : void;
  getHello(url: string, req: GetHelloRequest): Promise<GetHelloResponseOK>;
  getFoo(url: string, req: GetFooRequest): Promise<GetFooResponseOK>;
}

type PlatformaticFrontendClient = Omit<Api, 'setBaseUrl'>
export default function build(url: string): PlatformaticFrontendClient
