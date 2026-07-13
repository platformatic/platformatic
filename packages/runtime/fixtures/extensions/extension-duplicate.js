export default function setup ({ itc }) {
  itc.handle('extension:dup', () => 1)
  itc.handle('extension:dup', () => 2)
}
