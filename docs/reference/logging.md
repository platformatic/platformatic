# Logging

Platformatic DB uses a low overhead logger named [Pino](https://github.com/pinojs/pino)
to output structured log messages.

## Logger output level

By default the logger output level is set to `info`, meaning that all log messages
with a level of `info` or above will be output by the logger. See the
[Pino documentation](https://github.com/pinojs/pino/blob/master/docs/api.md#level-string)
for details on the supported log levels.

The logger output level can be overriden by adding a `logger` object to the `core`
configuration settings group:

```json title="platformatic.db.json"
{
  "core": {
    "logger": {
      "level": "error"
    },
   ...
  },
  ...
}
```

## Log formatting

If you run Platformatic DB in a terminal, where standard out ([stdout](https://en.wikipedia.org/wiki/Standard_streams#Standard_output_(stdout)))
is a [TTY](https://en.wikipedia.org/wiki/Tty_(Unix)):

- [pino-pretty](https://github.com/pinojs/pino-pretty) is automatically used
to pretty print the logs and make them easier to read during development.
- The Platformatic logo is printed (if colors are supported in the terminal emulator)

Example:

```bash 
$ npx platformatic db start
                                                      
                                                                                
                                                                                
                                                                                
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

If stdout is redirected to a non-TTY, the logo is not printed and the logs are
formatted as newline-delimited JSON:

```bash
$ npx platformatic db start | head
{"level":30,"time":1665566628973,"pid":338365,"hostname":"darkav2","url":"http://127.0.0.1:3042","msg":"server listening"}
```
