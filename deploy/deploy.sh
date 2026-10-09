#!/usr/bin/env bash
# Deploy the current HEAD commit of the checked-out branch to Railway and wait for the result.
#
#   deploy/deploy.sh api worker          # dev project (default), services in the given order
#   deploy/deploy.sh --prod api worker frontend
#
# Uses Railway's serviceInstanceDeployV2 with an explicit commit SHA, because `railway redeploy --from-source`
# occasionally builds the commit Railway last saw rather than the one just pushed. The commit must be pushed first.
set -euo pipefail

PROJECT=5ad19bb3-612e-4088-b188-cc58c94214a9; ENV=133ca1aa-f44a-40a6-9364-862a9fea7338; BRANCH=dev        # dev
if [ "${1:-}" = "--prod" ]; then
  PROJECT=cd1607c6-06af-406c-bb80-1c7cf036c692; ENV=344deb4f-f1c1-4d37-a22f-3800dafd3b6e; BRANCH=main; shift
fi
[ $# -gt 0 ] || { echo "usage: $0 [--prod] <service>..." >&2; exit 2; }

sha=$(git rev-parse HEAD)
if ! git merge-base --is-ancestor "$sha" "origin/$BRANCH" 2>/dev/null; then
  echo "HEAD $sha is not on origin/$BRANCH — push first (git push origin $BRANCH)" >&2; exit 1
fi

services_json=$(railway api 'query p($id:String!){ project(id:$id){ services { edges { node { id name } } } } }' \
  --variables "{\"id\":\"$PROJECT\"}")

for name in "$@"; do
  sid=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(next(e['node']['id'] for e in d['data']['project']['services']['edges'] if e['node']['name']=='$name'))" "$services_json")
  dep=$(railway api 'mutation d($s:String!,$e:String!,$c:String!){ serviceInstanceDeployV2(serviceId:$s, environmentId:$e, commitSha:$c) }' \
    --variables "{\"s\":\"$sid\",\"e\":\"$ENV\",\"c\":\"$sha\"}" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['serviceInstanceDeployV2'])")
  echo "$name: deployment $dep (commit ${sha:0:7})"
  while :; do
    status=$(railway api 'query d($id:String!){ deployment(id:$id){ status } }' --variables "{\"id\":\"$dep\"}" \
      | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['deployment']['status'])")
    echo "  $name: $status"
    case "$status" in
      SUCCESS) break ;;
      FAILED|CRASHED|REMOVED|SKIPPED) echo "$name deployment $dep ended with $status — read its logs: railway logs -d $dep" >&2; exit 1 ;;
    esac
    sleep 15
  done
done
