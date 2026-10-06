{{/*
Shared helpers. Components are named after the service (one release per namespace), so
in-cluster URLs stay `http://<service>:<port>` in every environment.
*/}}

{{- define "marketplace.labels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/part-of: cse-keyboards
app.kubernetes.io/version: {{ .root.Values.global.image.tag | quote }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .root.Chart.Name .root.Chart.Version }}
cse.dev/environment: {{ .root.Values.global.environment }}
{{- end }}

{{- define "marketplace.selectorLabels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end }}

{{/*
Image reference: registry/prefix/name:tag. Refuses a missing registry or tag and `latest`.
Components with environment-specific build output (the web app inlines its public URLs) are
built once per environment and tagged <sha>-<environment>.
*/}}
{{- define "marketplace.image" -}}
{{- $image := .root.Values.global.image -}}
{{- $registry := required "global.image.registry is required (ECR registry)" $image.registry -}}
{{- $tag := required "global.image.tag is required (the Git SHA of the build)" $image.tag -}}
{{- if eq (lower $tag) "latest" -}}
{{- fail "global.image.tag must be an immutable Git SHA, never latest" -}}
{{- end -}}
{{- $component := index .root.Values.components .name -}}
{{- if $component.imagePerEnvironment -}}
{{- $tag = printf "%s-%s" $tag .root.Values.global.environment -}}
{{- end -}}
{{- printf "%s/%s/%s:%s" $registry $image.repositoryPrefix .name $tag -}}
{{- end }}

{{/* Settings derived from the public domains, per component. */}}
{{- define "marketplace.derivedEnv" -}}
{{- $web := .root.Values.global.domains.web -}}
{{- $api := .root.Values.global.domains.api -}}
{{- if eq .name "api-gateway" }}
CORS_ORIGINS: {{ printf "https://%s" (required "global.domains.web is required" $web) | quote }}
{{- else if eq .name "auth-service" }}
WEB_URL: {{ printf "https://%s" (required "global.domains.web is required" $web) | quote }}
{{- else if eq .name "notification-service" }}
WEB_URL: {{ printf "https://%s" (required "global.domains.web is required" $web) | quote }}
PUBLIC_API_URL: {{ printf "https://%s" (required "global.domains.api is required" $api) | quote }}
{{- end }}
{{- end }}

{{- define "marketplace.secretName" -}}
{{- printf "%s-secrets" .name -}}
{{- end }}

{{/* True unless the component explicitly sets the flag to false. */}}
{{- define "marketplace.enabled" -}}
{{- if eq (toString .) "false" -}}false{{- else -}}true{{- end -}}
{{- end }}
