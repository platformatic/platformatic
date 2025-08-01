import { bold, green, isColorSupported } from 'colorette'
import { getExecutableName } from './embedding.js'

export function logo () {
  const executableName = isColorSupported ? bold(getExecutableName()) : getExecutableName()
  const str = `

                                  //////
                               /////////////
                           ///////      ///////
                        ///////            ///////
                     ///////                  ///////
                     ////                        ////
              &&&&   ////                        ////   &&&&
           &&&&&&&   ////                        ////   &&&&&&&
        &&&&&&&      ////                        ////      &&&&&&&
        &&&&         ////                        ////         &&&&&&&
        &&&&         ////                        ////            &&&&     &&
        &&&&         ////                        ////             &&&    &&&&&&
        &&&&         ////                        ////             &&&      &&&&&&
        &&&&                 /////              /////             &&&         &&&&
        &&&&              ///////            ///////              &&&         &&&&
        &&&&              //////          ///////                 &&&      &&&&&&&
        &&&&         //// /////////   ////////                    &&&    &&&&&&
        &&&&         //// ///  ////////////      &&&&             &&&    &&&
        &&&&&&&      //// ///     /////          &&&&            &&&&
           &&&&&&&   ////                  &&&   &&&&&        &&&&&&&
              &&&    ////                 &&&&    &&&&&&&  &&&&&&&
                     //// &&&             &&&&       &&&&&&&&&&
                     //// &&&             &&&&          &&&&
                      //  &&&&&           &&&&
                           &&&&&&&      &&&&&&
                              &&&&&&&&&&&&&
                                  &&&&&&

                            Welcome to ${executableName}!
`

  /* c8 ignore next - else */
  return isColorSupported ? str.replace(/\//g, s => green(s)) : str
}
