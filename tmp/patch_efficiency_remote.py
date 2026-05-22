from pathlib import Path

p = Path('/var/www/unicorn/UNICORN_FINAL/scripts/deepseek-loop.js')
text = p.read_text()
text = text.replace("""  out.autonomy = {
    root: AUTONOMY_ROOT,
    sandboxRoot: SANDBOX_ROOT,
    autonomousLogPath: AUTONOMOUS_LOG_PATH,
    cleanupCandidates: collectCleanupCandidates(),
    recentAutonomousActions: readAutonomousLogTail(),
  };
  return out;
}
""", """  out.autonomy = {
    root: AUTONOMY_ROOT,
    sandboxRoot: SANDBOX_ROOT,
    autonomousLogPath: AUTONOMOUS_LOG_PATH,
    cleanupCandidates: collectCleanupCandidates(),
    recentAutonomousActions: readAutonomousLogTail(),
  };
  out.workMode = {
    name: 'efficient-full-stack',
    primaryFocus: ['unicorn-server-and-backend', 'public-site-and-pricing'],
    minimizeRepeatedDiagnosis: true,
    preferImplementationWhenClear: true,
  };
  return out;
}
""")
text = text.replace("""  'Priority zero is balanced production stability: never trade away Unicorn backend reliability, and never ignore the public site, pricing, or conversion paths. ' +
    'INNOVATION MANDATE: when no fire is burning, generate code_proposal envelopes for features that DO NOT YET EXIST on any competing SaaS — AI-personalized pricing per visitor, 24/7 AI commerce concierge, revenue-anomaly self-healing, sovereign anonymized-insights marketplace, BTC Lightning instant settlement, autonomous blue/green deploys. Invent what hasn\'t been invented. ' +
""", """  'Priority zero is balanced production stability: never trade away Unicorn backend reliability, and never ignore the public site, pricing, or conversion paths. ' +
    'EFFICIENCY MANDATE: be decisive and avoid repetitive diagnosis. If STATUS is already clear and no fresh error is present, do not spend a tick on read_status again; move to implementation, validation, or a code_proposal that advances an open objective. ' +
    'One useful action beats several passive checks. Prefer actions that change the system or close an objective, and only inspect again when that inspection will change the next move. ' +
    'INNOVATION MANDATE: when no fire is burning, generate code_proposal envelopes for features that DO NOT YET EXIST on any competing SaaS — AI-personalized pricing per visitor, 24/7 AI commerce concierge, revenue-anomaly self-healing, sovereign anonymized-insights marketplace, BTC Lightning instant settlement, autonomous blue/green deploys. Invent what hasn\'t been invented. ' +
""")
text = text.replace("""  'Prioritization rules: (1) if operatorCommand is present, address it first; (2) otherwise pick the highest-priority open objective from roadmap.topOpenObjectives and act toward it; (3) prefer read_status / read_file for diagnosis, then code_proposal for fixes; (4) when everything is green, generate an innovation code_proposal toward an `innovation: true` objective. ' +
""", """  'Prioritization rules: (1) if operatorCommand is present, address it first; (2) otherwise pick the highest-priority open objective from roadmap.topOpenObjectives and act toward it; (3) prefer implementation or code_proposal when the objective is clear, and use read_status / read_file only when they unlock the next step; (4) when everything is green, generate an innovation code_proposal toward an `innovation: true` objective. ' +
""")
p.write_text(text)
print('patched')