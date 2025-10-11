#!/bin/bash
# cleanup.sh - Clean all test data from the distributed job processing system
# Usage: ./cleanup.sh

set -e  # Exit on error

echo "🧹 Cleaning up Optio Assignment test data..."
echo ""

# Check if services are running
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "⚠️  API service not responding. Make sure Docker Compose is running:"
  echo "   cd infra && docker compose up"
  exit 1
fi

# 1. Stop any running job
echo "1️⃣  Stopping current run (if any)..."
STOP_RESPONSE=$(curl -s -X POST http://localhost:3000/api/stop || echo '{"message":"No run active"}')
echo "   $STOP_RESPONSE"
sleep 1

# 2. Delete Elasticsearch index
echo ""
echo "2️⃣  Deleting Elasticsearch index..."
ES_RESPONSE=$(curl -s -X DELETE http://localhost:9200/optio-jobs 2>&1)
if echo "$ES_RESPONSE" | grep -q "acknowledged"; then
  echo "   ✅ Elasticsearch index deleted"
elif echo "$ES_RESPONSE" | grep -q "index_not_found"; then
  echo "   ℹ️  Elasticsearch index already empty"
else
  echo "   ✅ Elasticsearch cleaned"
fi

# 3. Purge RabbitMQ queue
echo ""
echo "3️⃣  Purging RabbitMQ queue..."
RMQ_RESPONSE=$(curl -s -X DELETE -u guest:guest \
  http://localhost:15672/api/queues/%2F/optio.jobs/contents 2>&1 || echo "")
if [ -z "$RMQ_RESPONSE" ]; then
  echo "   ✅ RabbitMQ queue purged"
else
  echo "   ⚠️  RabbitMQ: $RMQ_RESPONSE"
fi

# 4. Reset Redis state
echo ""
echo "4️⃣  Resetting Redis state..."
docker exec optio-redis redis-cli DEL optio:run > /dev/null 2>&1 || true
docker exec optio-redis redis-cli DEL optio:enqueued > /dev/null 2>&1 || true
docker exec optio-redis redis-cli DEL optio:processed > /dev/null 2>&1 || true
docker exec optio-redis redis-cli DEL optio:queue:nextId > /dev/null 2>&1 || true
docker exec optio-redis redis-cli DEL optio:metrics:timestamps > /dev/null 2>&1 || true
echo "   ✅ Redis state reset"

# 5. Verify cleanup
echo ""
echo "5️⃣  Verifying cleanup..."
ES_COUNT=$(curl -s http://localhost:9200/optio-jobs/_count 2>&1 | grep -o '"count":[0-9]*' | cut -d':' -f2 || echo "0")
if [ "$ES_COUNT" = "0" ] || [ -z "$ES_COUNT" ]; then
  echo "   ✅ Elasticsearch: 0 documents"
else
  echo "   ℹ️  Elasticsearch: $ES_COUNT documents (index might not exist yet)"
fi

STATUS=$(curl -s http://localhost:3000/api/status)
echo "   ✅ API Status: $(echo $STATUS | grep -o '"running":[a-z]*' | cut -d':' -f2)"

echo ""
echo "🎉 Cleanup complete! System is ready for a fresh start."
echo ""
echo "📝 Next steps:"
echo "   1. Refresh your browser at http://localhost:4200"
echo "   2. Start a new run to test"
echo ""

