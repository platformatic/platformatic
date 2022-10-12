# Logging

Platformatic uses [pino](https://github.com/pinojs/pino), a very fast JSON logger.

The logging level is configured in `core`:

```json title="platformatic.db.json"
{
  "core": {
    "logger": {
      "level": "{PLT_SERVER_LOGGER_LEVEL}"
    },
   ...
  },
  ...

}
``` 

The `logger` configuration is optional. If missing, the default level is `info` (see [here](https://github.com/pinojs/pino/blob/master/docs/api.md#level-string) for the log levels supported by pino)


If you run in a terminal (stdout is a TTY):
- [pino-pretty](https://github.com/pinojs/pino-pretty) is automatically used as transport to format the logs. 
- the logo is printend (if colors are supported in the terminal emulator):

```bash 
➜ npx platformatic db start
                                                      
                                                                                
                                                                                
                                                                                
                           /////////////                                        
                        /////         /////                                     
                      ///                 ///                                   
                    ///                     ///                                 
                   ///                       ///                                
               &&  ///                       ///  &&                            
          &&&&&&   ///                       ///   &&&&&&                       
        &&&&       ///                      ///        &&&&                     
      &&&          ///                     ///            &&&&&&&&&&&&          
     &&&           ///     ///////      ////               &&       &&&&&       
     &&            ///    ///////////////                               &&&     
    &&&            ///     ///                                           &&&    
     &&&           ///      //                                            &&    
     &&&           ///                                                    &&    
       &&&         ///                                                   &&&    
         &&&&      ///                                                 &&&      
            &&&&&  ///  &&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&        
                   ///                                                          
                   ///                                                          
                   ///                                                          
                   ///                                                          
                   ///                                                          
                   ///                                                          
                                                                                

[11:20:33.466] INFO (337606): server listening
    url: "http://127.0.0.1:3042"

```

If stdout is redirected to a non-TTY, the logo is not printed and the logs are formatted as newline-delimited JSON:

```bash
➜ npx platformatic db start | head
{"level":30,"time":1665566628973,"pid":338365,"hostname":"darkav2","url":"http://127.0.0.1:3042","msg":"server listening"}

```

