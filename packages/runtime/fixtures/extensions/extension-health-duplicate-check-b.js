export default function setup ({ health }) {
  health.registerReadinessCheck('shared', () => false)
}
