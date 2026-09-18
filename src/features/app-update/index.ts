export type { InstalledVersion, VersionManifest, UpdateDecision } from './appVersion'
export { compareVersionNames, decideUpdate } from './appVersion'
export {
  fetchVersionManifest,
  isValidManifest,
  resolveManifestBaseUrl,
  resolveManifestUrl,
} from './versionManifest'
export type { FetchLike } from './versionManifest'
