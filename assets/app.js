new Vue({
    el: '#app',
    data: {
        domain: '',
        results: [],
        loading: false
    },
    computed: {
        groupedResults() {
            return this.results.reduce((acc, record) => {
                if (!acc[record.type]) {
                    acc[record.type] = [];
                }
                acc[record.type].push(record);
                return acc;
            }, {});
        }
    },
    created() {
        // Check for domain parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const domainParam = urlParams.get('domain');
        if (domainParam) {
            this.domain = domainParam;
            this.checkDNS();
        }
    },
    methods: {
        async checkDNS() {
            if (!this.domain) {
                alert('Please enter a domain name');
                return;
            }

            // Update URL with domain parameter
            const url = new URL(window.location);
            url.searchParams.set('domain', this.domain);
            window.history.pushState({}, '', url);

            const dnsTypes = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'PTR', 'SOA', 'SRV', 'CAA', 'CNAME'];
            this.loading = true;
            this.results = [];

            try {
                const output = await Promise.all(dnsTypes.map(type => this.fetchDNSRecord(type)));
                this.results = output.flat();
            } catch (error) {
                console.error('An error occurred while fetching DNS records:', error);
            } finally {
                this.loading = false;
            }
        },
        async fetchDNSRecord(type) {
            const response = await fetch(`https://dns.google/resolve?name=${this.domain}&type=${type}`);
            const data = await response.json();
            return this.formatResult(data, type);
        },
        async formatResult(data, type) {
            if (!data.Answer || data.Answer.length === 0) {
                return [];
            }

            return Promise.all(data.Answer.map(async (record, index) => {
                let value = this.removeCommas(record.data);
                if (['A', 'AAAA'].includes(type)) {
                    const hostname = await this.getHostname(record.data);
                    value += ` (${hostname})`;
                }
                return {
                    id: `${type}-${index}`,
                    type: type,
                    name: this.removeCommas(record.name),
                    TTL: record.TTL,
                    value: value
                };
            }));
        },
        async getHostname(ip) {
            try {
                const reverseIp = ip.split('.').reverse().join('.') + '.in-addr.arpa';
                const response = await fetch(`https://dns.google/resolve?name=${reverseIp}&type=PTR`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.Answer && data.Answer.length > 0) {
                    return this.removeCommas(data.Answer[0].data);
                } else {
                    return "Hostname not found";
                }
            } catch (error) {
                console.error('Error fetching hostname:', error);
                return "Error fetching hostname";
            }
        },
        removeCommas(str) {
            return str.replace(/,/g, '');
        }
    }
});