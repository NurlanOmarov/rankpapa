export type SiteStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type GeoCity = 'ALMATY' | 'ASTANA' | 'SHYMKENT' | 'ALL';
export type DeviceType = 'DESKTOP' | 'MOBILE' | 'MIXED';

export interface Site {
  id: string;
  userId: string;
  domain: string;
  status: SiteStatus;
  geo: GeoCity;
  deviceType: DeviceType;
  createdAt: Date;
}
