import * as cdk from "@aws-cdk/core"
import {StackProps} from "@aws-cdk/core"
import {SubnetType, Vpc} from "@aws-cdk/aws-ec2";

export interface VpcStackProps extends StackProps {
    cidrRange: string
}

export class VpcStack extends cdk.Stack {

    private _vpc: Vpc

    constructor(scope: cdk.Construct, id: string, props: VpcStackProps) {
        super(scope, id, props);

        this._vpc = new Vpc(this, 'vpc', {
            enableDnsHostnames: true,
            enableDnsSupport: true,
            cidr: props.cidrRange,
            subnetConfiguration: [{
                name: `private-subnet`,
                subnetType: SubnetType.PRIVATE
            }, {
                name: 'public',
                subnetType: SubnetType.PUBLIC
            }],
            maxAzs: this.availabilityZones.length,
            natGateways: 1
        })

    }

    get vpc(): Vpc {
        return this._vpc;
    }
}
