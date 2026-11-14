import React from 'react';
import './wizard.css';
export default function WizardProgress({steps,step}) {
 return <nav className="deltatv-wizard" aria-label="Etapas do cadastro"><ol>{steps.map((label,index)=><li key={label} aria-current={step===index?'step':undefined} className={index<step?'done':index===step?'current':''}><span aria-hidden="true">{index<step?'✓':index+1}</span><small>{label}</small></li>)}</ol></nav>;
}
