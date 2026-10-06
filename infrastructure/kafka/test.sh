#!/usr/bin/env bash
# Integration test for apply.sh on a real broker with SASL/SCRAM and the ACL authorizer, set up
# like MSK: first with allow.everyone.if.no.acl.found=true (how a new cluster starts), then
# restarted with it false (how it runs once the ACLs are in). Needs Docker. Run by CI.
set -euo pipefail

image=apache/kafka:4.3.1@sha256:77e3df9054047a88b520d0cc46e16696d3b22022e1d580aeccd2632df6532837
here="$(cd "$(dirname "$0")" && pwd)"
net=kafka-acl-test
broker=kafka-acl-test-broker
volume=kafka-acl-test-data

cleanup() {
  docker rm -f "$broker" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
  docker network rm "$net" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup
docker network create "$net" >/dev/null
docker volume create "$volume" >/dev/null
docker run --rm -u 0 -v "$volume:/data" --entrypoint chown "$image" 1000:1000 /data

start_broker() { # allow.everyone.if.no.acl.found
  docker rm -f "$broker" >/dev/null 2>&1 || true
  # Clients use SASL (port 9092) only. The plaintext broker/controller listeners are for the
  # node itself (its anonymous principal is the super user), as inside MSK.
  docker run -d --name "$broker" --network "$net" -v "$volume:/data" \
    -e CLUSTER_ID=4L6g3nShT-eMCtK--X86sw \
    -e KAFKA_NODE_ID=1 \
    -e KAFKA_PROCESS_ROLES=broker,controller \
    -e KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093 \
    -e KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
    -e KAFKA_LISTENERS=SASL://:9092,BROKER://:9091,CONTROLLER://:9093 \
    -e KAFKA_ADVERTISED_LISTENERS=SASL://$broker:9092,BROKER://localhost:9091 \
    -e KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=SASL:SASL_PLAINTEXT,BROKER:PLAINTEXT,CONTROLLER:PLAINTEXT \
    -e KAFKA_INTER_BROKER_LISTENER_NAME=BROKER \
    -e KAFKA_SASL_ENABLED_MECHANISMS=SCRAM-SHA-512 \
    -e 'KAFKA_LISTENER_NAME_SASL_SCRAM___SHA___512_SASL_JAAS_CONFIG=org.apache.kafka.common.security.scram.ScramLoginModule required;' \
    -e KAFKA_AUTHORIZER_CLASS_NAME=org.apache.kafka.metadata.authorizer.StandardAuthorizer \
    -e KAFKA_SUPER_USERS=User:ANONYMOUS \
    -e KAFKA_ALLOW_EVERYONE_IF_NO_ACL_FOUND="$1" \
    -e KAFKA_AUTO_CREATE_TOPICS_ENABLE=false \
    -e KAFKA_LOG_DIRS=/data/logs \
    -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
    -e KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1 \
    -e KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1 \
    -e KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0 \
    -e KAFKA_HEAP_OPTS='-Xmx384m -Xms128m' \
    "$image" >/dev/null
  for _ in $(seq 45); do
    if docker exec "$broker" /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9091 --list >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done
  docker logs "$broker" | tail -40
  echo "broker did not start" >&2
  exit 1
}

# A client container acting as one Kafka user.
as() { # user command...
  local user="$1"
  shift
  docker run --rm -i --network "$net" --entrypoint bash "$image" -c "
    printf '%s\n' 'security.protocol=SASL_PLAINTEXT' 'sasl.mechanism=SCRAM-SHA-512' \
      'sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username=\"$user\" password=\"$user-secret\";' \
      > /tmp/client.properties
    $*" 2>&1 || true
}
produce() { # user topic
  echo "message from $1" | as "$1" "/opt/kafka/bin/kafka-console-producer.sh --bootstrap-server $broker:9092 \
    --command-config /tmp/client.properties --topic $2 --command-property max.block.ms=10000"
}
consume() { # user topic group
  as "$1" "/opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server $broker:9092 \
    --command-config /tmp/client.properties --topic $2 --group $3 --from-beginning \
    --max-messages 1 --timeout-ms 15000"
}
apply() {
  # As restricted as the Job in the cluster: non-root, read-only root filesystem, /tmp only.
  docker run --rm --network "$net" -v "$here:/access:ro" --entrypoint bash \
    -u 1000:1000 --read-only --tmpfs /tmp -e LOG_DIR=/tmp/logs -e KAFKA_HEAP_OPTS=-Xmx256m \
    -e KAFKA_BOOTSTRAP="$broker:9092" -e KAFKA_SECURITY_PROTOCOL=SASL_PLAINTEXT \
    -e KAFKA_ADMIN_USERNAME=kafka-admin -e KAFKA_ADMIN_PASSWORD=kafka-admin-secret \
    -e KAFKA_ACCESS_DIR=/access "$image" /access/apply.sh
}

failures=0
refused='AuthorizationException|[Nn]ot authorized'
expect_ok() { # description output: no error at all
  if grep -qE "Exception|ERROR|$refused" <<<"$2"; then
    echo "FAIL $1"
    echo "$2" | tail -5 | sed 's/^/     /'
    failures=$((failures + 1))
  else
    echo "ok   $1"
  fi
}
expect() { # description pattern output
  if grep -qE "$2" <<<"$3"; then
    echo "ok   $1"
  else
    echo "FAIL $1"
    echo "$3" | tail -5 | sed 's/^/     /'
    failures=$((failures + 1))
  fi
}

echo "── bootstrap: allow.everyone.if.no.acl.found=true"
start_broker true
for user in kafka-admin order-service payment-service cart-service; do
  docker exec "$broker" /opt/kafka/bin/kafka-configs.sh --bootstrap-server localhost:9091 --alter \
    --add-config "SCRAM-SHA-512=[password=$user-secret]" --entity-type users --entity-name "$user" >/dev/null
done

out="$(apply)"
echo "$out"
expect "first run creates the topics and ACLs" 'topics: 12, ACLs: [0-9]+ \(added [1-9][0-9]*, removed 0\)' "$out"
out="$(apply)"
expect "a second run changes nothing" 'added 0, removed 0' "$out"

checks() {
  out="$(produce order-service orders.order.events)"
  expect_ok "order-service publishes order events" "$out"
  out="$(produce order-service payments.payment.events)"
  expect "order-service cannot publish payment events" "$refused" "$out"
  out="$(consume payment-service orders.order.events payment-service.orders)"
  expect "payment-service consumes order events in its own group" 'message from order-service' "$out"
  out="$(consume payment-service orders.order.events cart-service.orders)"
  expect "payment-service cannot use another service's group" "$refused" "$out"
  out="$(consume order-service orders.order.events order-service.spy)"
  expect "order-service cannot read (even its own topic)" "$refused" "$out"
  out="$(as cart-service "/opt/kafka/bin/kafka-acls.sh --bootstrap-server $broker:9092 --command-config /tmp/client.properties \
    --add --allow-principal User:cart-service --operation All --topic '*'")"
  expect "a service cannot grant itself more" "$refused" "$out"
  out="$(as cart-service "/opt/kafka/bin/kafka-topics.sh --bootstrap-server $broker:9092 --command-config /tmp/client.properties \
    --create --topic cart.sneaky")"
  expect "a service cannot create topics" "$refused" "$out"
}
checks

echo "── drift: an ACL added by hand is revoked by the next run"
as kafka-admin "/opt/kafka/bin/kafka-acls.sh --bootstrap-server $broker:9092 --command-config /tmp/client.properties \
  --add --allow-principal User:order-service --operation Write --topic payments.payment.events" >/dev/null
out="$(produce order-service payments.payment.events)"
expect_ok "(the hand-made ACL works)" "$out"
out="$(apply)"
expect "apply removes it" 'removed: User:order-service TOPIC LITERAL payments.payment.events WRITE' "$out"
out="$(produce order-service payments.payment.events)"
expect "order-service cannot publish payment events again" "$refused" "$out"

echo "── steady state: allow.everyone.if.no.acl.found=false"
start_broker false
checks
out="$(apply)"
expect "the admin user still manages everything" 'added 0, removed 0' "$out"

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed" >&2
  exit 1
fi
echo "all Kafka access checks passed"
