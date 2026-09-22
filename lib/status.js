export function overallStatus(requirementsStatus, paymentStatus) {
  if (requirementsStatus === 'rejected') return 'requirements_rejected';
  if (paymentStatus === 'rejected') return 'payment_rejected';
  if (requirementsStatus === 'valid' && paymentStatus === 'verified') return 'verified';
  if (requirementsStatus === 'valid') return 'waiting_payment';
  if (paymentStatus === 'verified') return requirementsStatus === 'incomplete' ? 'requirements_incomplete' : 'waiting_requirements';
  if (requirementsStatus === 'incomplete') return 'requirements_incomplete';
  return 'pending';
}
