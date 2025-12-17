
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/mysql';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId parameter' }, { status: 400 });
    }

    // Nodes and Links arrays
    const nodes: any[] = [];
    const links: any[] = [];
    const nodeIds = new Set<string>();

    // Helper to add node
    const addNode = (id: string, label: string, type: string, val: number = 1) => {
      if (!nodeIds.has(id)) {
        nodes.push({ id, name: label, type, val });
        nodeIds.add(id);
      }
    };

    // 1. Get the Central Device
    // Query systeminformation for this device
    const deviceResult = await executeQuery(
      `SELECT * FROM systeminformation WHERE device_id = ?`,
      [deviceId]
    ) as any[];

    // Also get device name from devices table
    const deviceMeta = await executeQuery(
        `SELECT device_name FROM devices WHERE device_id = ?`,
        [deviceId]
    ) as any[];

    const deviceName = deviceMeta[0]?.device_name || deviceId;

    // Add Central Device Node
    addNode(deviceId, `Device: ${deviceName}`, 'device', 20);

    if (deviceResult.length > 0) {
        const info = deviceResult[0];

        // Add IP Node
        if (info.ip_address) {
            const ipId = `IP:${info.ip_address}`;
            addNode(ipId, info.ip_address, 'ip', 10);
            links.push({ source: deviceId, target: ipId, label: 'HAS_IP' });

            // Find other devices with this IP (Pivot 1)
            const sameIpDevices = await executeQuery(
                `SELECT device_id, username FROM systeminformation WHERE ip_address = ? AND device_id != ? LIMIT 5`,
                [info.ip_address, deviceId]
            ) as any[];

            sameIpDevices.forEach(d => {
                addNode(d.device_id, `Device: ${d.username || 'Unknown'}`, 'device', 15);
                links.push({ source: ipId, target: d.device_id, label: 'SHARED_IP' });
            });
        }
    }

    // 2. Get Top Domains for this device
    const domainResult = await executeQuery(
        `SELECT domain, COUNT(*) as count FROM credentials WHERE device_id = ? GROUP BY domain ORDER BY count DESC LIMIT 10`,
        [deviceId]
    ) as any[];

    domainResult.forEach(d => {
        if (d.domain) {
            const domainId = `DOM:${d.domain}`;
            addNode(domainId, d.domain, 'domain', 5 + (d.count / 2)); // Size based on cred count
            links.push({ source: deviceId, target: domainId, label: 'ACCESSED' });
        }
    });

    return NextResponse.json({ nodes, links });
  } catch (error) {
    console.error('Error fetching graph data:', error);
    return NextResponse.json({ error: 'Failed to fetch graph data' }, { status: 500 });
  }
}
