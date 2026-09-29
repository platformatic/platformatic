import { strictEqual } from 'node:assert'
import { test } from 'node:test'
import { extractFunctionName, isMinifiedName } from '../lib/function-name.js'

test('should extract the name of a function declaration', () => {
  strictEqual(extractFunctionName('function renderElement(request, task) {', 0), 'renderElement')
  strictEqual(extractFunctionName('function renderElement(request, task) {', 9), 'renderElement')
  strictEqual(extractFunctionName('  async function fetchData() {', 2), 'fetchData')
  strictEqual(extractFunctionName('export function normalizeAppPath(route: string) {', 7), 'normalizeAppPath')
  strictEqual(extractFunctionName('export default async function Page() {', 0), 'Page')
  strictEqual(extractFunctionName('function* entries(object) {', 0), 'entries')
  strictEqual(extractFunctionName('  return function parseCookie() {', 9), 'parseCookie')
})

test('should extract the name of a function assigned to a variable or a property', () => {
  strictEqual(extractFunctionName('const handler = () => {', 0), 'handler')
  strictEqual(extractFunctionName('const handler = () => {', 16), 'handler')
  strictEqual(extractFunctionName('export const scheduleOnNextTick = (cb: ScheduledFn<void>) => {', 7), 'scheduleOnNextTick')
  strictEqual(extractFunctionName('const replaceClose = (', 21), 'replaceClose')
  strictEqual(extractFunctionName('exports.useMemo = function (create, deps) {', 18), 'useMemo')
  strictEqual(extractFunctionName('    useContext: function (context) {', 16), 'useContext')
  strictEqual(extractFunctionName('    cacheKeyFn: ({ key }) => key,', 16), 'cacheKeyFn')
  strictEqual(extractFunctionName('  const process = async (item) => {', 18), 'process')
  strictEqual(extractFunctionName('  double: n => n * 2,', 10), 'double')
})

test('should extract the name of a method', () => {
  strictEqual(extractFunctionName('  render() {', 2), 'render')
  strictEqual(extractFunctionName('  async componentDidMount() {', 2), 'componentDidMount')
  strictEqual(extractFunctionName('  static async create(options) {', 2), 'create')
  strictEqual(extractFunctionName('}, *refiner(value, context) {', 4), 'refiner')
})

test('should not name a callback after the statement it is in', () => {
  strictEqual(extractFunctionName('      abortableTasks.forEach(function (task) {', 29), null)
  strictEqual(extractFunctionName('  useEffect(() => {', 12), null)
  strictEqual(extractFunctionName('const result = items.filter(Boolean).map((item) => item.id)', 41), null)
  strictEqual(extractFunctionName('  setImmediate(function () {', 15), null)
})

test('should not extract a name from a line without functions', () => {
  strictEqual(extractFunctionName('const basePath = (process.env.BASE_PATH as string) || ""', 0), null)
  strictEqual(extractFunctionName('export const HTML_CONTENT_TYPE_HEADER = "text/html"', 7), null)
  strictEqual(extractFunctionName('  if (condition) {', 2), null)
  strictEqual(extractFunctionName('  return result', 2), null)
  strictEqual(extractFunctionName('  let resolvePending: () => void = () => {}', 35), null)
  strictEqual(extractFunctionName('', 0), null)
  strictEqual(extractFunctionName(null, 0), null)
  strictEqual(extractFunctionName(undefined), null)
})

test('should ignore minified lines', () => {
  strictEqual(extractFunctionName(`function a(){${'b();'.repeat(1000)}}`, 0), null)
})

test('should use the beginning of the line if the column is not valid', () => {
  strictEqual(extractFunctionName('function renderElement() {', 100), 'renderElement')
  strictEqual(extractFunctionName('function renderElement() {', -1), 'renderElement')
  strictEqual(extractFunctionName('function renderElement() {', null), 'renderElement')
})

test('should detect the names which carry no information', () => {
  strictEqual(isMinifiedName('eY'), true)
  strictEqual(isMinifiedName('a'), true)
  strictEqual(isMinifiedName('(anonymous)'), true)
  strictEqual(isMinifiedName('(anonymous:L#60:C#9)'), true)
  strictEqual(isMinifiedName(''), true)
  strictEqual(isMinifiedName(undefined), true)
  strictEqual(isMinifiedName('renderElement'), false)
  strictEqual(isMinifiedName('read'), false)
})
