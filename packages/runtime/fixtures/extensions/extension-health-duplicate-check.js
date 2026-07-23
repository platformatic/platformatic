export default function setup ({ health }) {
  health.registerReadinessCheck('shared', () => true)
  health.registerReadinessCheck('shared', () => true)
}
