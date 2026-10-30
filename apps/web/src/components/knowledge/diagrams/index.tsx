import type { ComponentType } from 'react';

import type { Locale } from '@/lib/i18n/config';
import type { DiagramId } from '@/lib/knowledge/types';

import { ChargeCycle } from './charge-cycle';
import { DataPipeline } from './data-pipeline';
import { ExplodedStack } from './exploded-stack';
import { HidReport } from './hid-report';
import { KeycapProfiles } from './keycap-profiles';
import { LayoutSizes } from './layout-sizes';
import { LegendMethods } from './legend-methods';
import { MatrixScan } from './matrix-scan';
import {
  MountBottom,
  MountGasket,
  MountIntegrated,
  MountSandwich,
  MountTop,
  MountTray,
} from './mounts';
import type { DiagramProps } from './parts';
import { SwitchTravel } from './switch-travel';

/**
 * Technical diagrams for the knowledge guide. Each is a pure inline SVG (server-component safe)
 * coloured through the `--diagram-*` CSS variables, with `data-part` hooks for animation.
 */

const DIAGRAMS: Record<DiagramId, ComponentType<DiagramProps>> = {
  'exploded-stack': ExplodedStack,
  'switch-travel': SwitchTravel,
  'mount-integrated': MountIntegrated,
  'mount-tray': MountTray,
  'mount-top': MountTop,
  'mount-bottom': MountBottom,
  'mount-sandwich': MountSandwich,
  'mount-gasket': MountGasket,
  'keycap-profiles': KeycapProfiles,
  'legend-methods': LegendMethods,
  'layout-sizes': LayoutSizes,
  'matrix-scan': MatrixScan,
  'hid-report': HidReport,
  'data-pipeline': DataPipeline,
  'charge-cycle': ChargeCycle,
};

export function Diagram({
  id,
  locale,
  className,
  title,
}: {
  id: DiagramId;
  locale: Locale;
  className?: string;
  title: string;
}) {
  const Component = DIAGRAMS[id];
  return <Component locale={locale} className={className} title={title} />;
}
