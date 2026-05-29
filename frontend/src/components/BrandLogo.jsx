import {Target} from 'lucide-react';
import './BrandLogo.css';

function BrandLogo({text='EDU-AI', iconSize=18})
{
  return (
    <span className="brand-logo">
      <Target size={iconSize} className="brand-logo-icon" />
      <span className="brand-logo-text">{text}</span>
    </span>
  );
}

export default BrandLogo;
